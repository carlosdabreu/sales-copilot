import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { anthropic } from "@/lib/anthropic";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

function extractJsonFromText(text: string) {
  const cleanedText = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : cleanedText;
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function getBaseUrl(url: string) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}`;
}

function isSameDomain(url: string, baseUrl: string) {
  try {
    const parsedUrl = new URL(url);
    const parsedBase = new URL(baseUrl);

    return parsedUrl.hostname.replace(/^www\./, "") === parsedBase.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

function cleanText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

async function scrapePage(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 SalesCopilotResearchBot/1.0 (+public website research)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}. Status: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, img, video, audio, iframe").remove();

  const title = cleanText($("title").text());
  const metaDescription = cleanText(
    $('meta[name="description"]').attr("content") || ""
  );

  const bodyText = cleanText($("body").text());

  const links = $("a")
    .map((_, element) => {
      const href = $(element).attr("href");
      if (!href) return null;

      try {
        return new URL(href, url).toString();
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean) as string[];

  return {
    url,
    title,
    metaDescription,
    bodyText,
    links,
  };
}

function pickRelevantLinks(links: string[], baseUrl: string) {
  const priorityTerms = [
    "about",
    "product",
    "products",
    "platform",
    "solution",
    "solutions",
    "pricing",
    "customers",
    "case-study",
    "case-studies",
    "resources",
    "security",
    "faq",
    "industries",
    "enterprise",
    "features",
    "services",
  ];

  const uniqueLinks = Array.from(new Set(links));

  return uniqueLinks
    .filter((link) => isSameDomain(link, baseUrl))
    .filter((link) => !link.includes("#"))
    .filter((link) => {
      const lower = link.toLowerCase();
      return priorityTerms.some((term) => lower.includes(term));
    })
    .slice(0, 8);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const websiteUrlInput = String(body.websiteUrl ?? "").trim();

    if (!websiteUrlInput) {
      return NextResponse.json(
        { success: false, error: "Website URL is required." },
        { status: 400 }
      );
    }

    const websiteUrl = normalizeUrl(websiteUrlInput);
    const baseUrl = getBaseUrl(websiteUrl);

    const homePage = await scrapePage(websiteUrl);
    const relevantLinks = pickRelevantLinks(homePage.links, baseUrl);

    const scrapedPages = [homePage];

    for (const link of relevantLinks) {
      try {
        const page = await scrapePage(link);
        scrapedPages.push(page);
      } catch (error) {
        console.warn("Skipping page:", link, error);
      }
    }

    const rawText = scrapedPages
      .map((page) => {
        return `
URL: ${page.url}
Title: ${page.title}
Description: ${page.metaDescription}
Content:
${page.bodyText}
`;
      })
      .join("\n\n---\n\n")
      .slice(0, 60000);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      messages: [
        {
          role: "user",
          content: `You are a B2B sales research analyst.

Analyze the public website content below and create a structured company research profile for a sales copilot.

Rules:
- Use only the website content provided.
- Do not invent facts, customer names, pricing, or metrics.
- If something is not stated, use "Unknown" or an empty array.
- Focus on information useful for discovery calls, demos, objection handling, qualification, and account planning.
- Return valid JSON only.
- Do not include markdown.
- Start with { and end with }.

Return this exact JSON structure:
{
  "company_name": "",
  "website_url": "",
  "company_summary": "",
  "what_they_sell": "",
  "target_buyers": [],
  "target_industries": [],
  "products_or_services": [
    {
      "name": "",
      "description": "",
      "key_capabilities": [],
      "business_outcomes": []
    }
  ],
  "value_proposition": "",
  "differentiators": [],
  "common_customer_pain_points": [],
  "business_outcomes": [],
  "proof_points": [],
  "case_studies_or_customers": [],
  "pricing_notes": "",
  "implementation_notes": "",
  "security_or_compliance_notes": "",
  "integrations_or_ecosystem": [],
  "competitors_mentioned": [],
  "likely_objections": [
    {
      "objection": "",
      "suggested_response": ""
    }
  ],
  "discovery_questions": [],
  "qualification_questions": [],
  "demo_angles": [],
  "follow_up_questions_for_seller": [],
  "open_questions_or_unknowns": []
}

Website URL:
${websiteUrl}

Scraped public website content:
${rawText}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const rawClaudeText = textBlock?.text ?? "";
    const jsonText = extractJsonFromText(rawClaudeText);
    const parsed = JSON.parse(jsonText);

    const { data: savedResearch, error: saveError } = await supabaseServer
      .from("sales_company_research")
      .insert({
        company_name: parsed.company_name || null,
        website_url: websiteUrl,
        raw_text: rawText,
        research_json: parsed,
      })
      .select("id")
      .single();

    if (saveError) {
      console.error("Company research save error:", saveError);
      throw new Error("Company research generated but failed to save.");
    }

    return NextResponse.json({
      success: true,
      researchId: savedResearch.id,
      data: parsed,
      pagesScraped: scrapedPages.map((page) => page.url),
    });
  } catch (error) {
    console.error("Company research failed:", error);

    const message =
      error instanceof Error ? error.message : "Unknown company research error";

    return NextResponse.json(
      {
        success: false,
        error: "Company research failed.",
        details: message,
      },
      { status: 500 }
    );
  }
}