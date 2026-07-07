import { NextResponse } from "next/server";
import mammoth from "mammoth";
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

async function parseOrRepairJson(rawClaudeText: string) {
  const jsonText = extractJsonFromText(rawClaudeText);

  try {
    return JSON.parse(jsonText);
  } catch (firstError) {
    console.error("Initial JSON parse failed. Attempting repair:", firstError);

    const repairMessage = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Repair this malformed JSON.

Rules:
- Return valid JSON only.
- Do not include markdown.
- Do not add commentary.
- Preserve the same structure and content as much as possible.
- Start with { and end with }.

Malformed JSON:
${jsonText}`,
        },
      ],
    });

    const repairTextBlock = repairMessage.content.find(
      (block) => block.type === "text"
    );

    const repairedRawText = repairTextBlock?.text ?? "";
    const repairedJsonText = extractJsonFromText(repairedRawText);

    return JSON.parse(repairedJsonText);
  }
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

    return (
      parsedUrl.hostname.replace(/^www\./, "") ===
      parsedBase.hostname.replace(/^www\./, "")
    );
  } catch {
    return false;
  }
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

async function scrapePage(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 SalesCopilotResearchBot/1.0 (+public sales knowledge research)",
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
    "integrations",
    "partners",
    "compare",
    "comparison",
  ];

  const uniqueLinks = Array.from(new Set(links));

  return uniqueLinks
    .filter((link) => isSameDomain(link, baseUrl))
    .filter((link) => !link.includes("#"))
    .filter((link) => {
      const lower = link.toLowerCase();
      return priorityTerms.some((term) => lower.includes(term));
    })
    .slice(0, 6);
}

async function scrapeWebsiteToText(websiteUrlInput: string) {
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
    .slice(0, 45000);

  return {
    websiteUrl,
    rawText,
    pagesScraped: scrapedPages.map((page) => page.url),
  };
}

async function extractTextFromFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = file.name.toLowerCase();

  if (filename.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (filename.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (filename.endsWith(".txt") || filename.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  throw new Error("Unsupported file type. Upload PDF, DOCX, TXT, or MD.");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const title = String(formData.get("title") ?? "").trim();
    const assetType = String(formData.get("assetType") ?? "").trim();
    const companyOrProduct = String(
      formData.get("companyOrProduct") ?? ""
    ).trim();
    const pastedText = String(formData.get("pastedText") ?? "").trim();
    const websiteUrlInput = String(formData.get("websiteUrl") ?? "").trim();
    const file = formData.get("file");

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Title is required." },
        { status: 400 }
      );
    }

    if (!assetType) {
      return NextResponse.json(
        { success: false, error: "Asset type is required." },
        { status: 400 }
      );
    }

    let rawText = pastedText;
    let sourceFilename: string | null = null;
    let normalizedWebsiteUrl: string | null = null;
    let pagesScraped: string[] = [];

    if (websiteUrlInput) {
      const websiteResult = await scrapeWebsiteToText(websiteUrlInput);
      rawText = websiteResult.rawText;
      normalizedWebsiteUrl = websiteResult.websiteUrl;
      sourceFilename = websiteResult.websiteUrl;
      pagesScraped = websiteResult.pagesScraped;
    } else if (file instanceof File && file.size > 0) {
      sourceFilename = file.name;
      rawText = await extractTextFromFile(file);
    }

    if (!rawText || rawText.length < 20) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please upload a valid file, paste enough source text, or provide a valid website URL.",
        },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `You are a sales enablement analyst.

Analyze the sales material and convert it into structured product knowledge for a live sales copilot.

The source may be a product overview, pitch deck, case study, value story, implementation guide, security FAQ, competitive battlecard, pricing note, objection handling guide, customer proof point, or public website scrape.

Rules:
- Do not invent facts.
- Extract only what is supported by the provided text.
- If a field is not present, use an empty string or empty array.
- Return valid JSON only.
- Do not include markdown.
- Start with { and end with }.
- Keep each array to no more than 8 items.
- Keep each string concise.

Return this exact JSON structure:
{
  "asset_summary": {
    "title": "",
    "asset_type": "",
    "company_or_product": "",
    "summary": "",
    "target_buyers": [],
    "target_industries": [],
    "core_value_proposition": "",
    "key_capabilities": [],
    "differentiators": [],
    "common_pain_points": [],
    "business_outcomes": [],
    "implementation_notes": [],
    "security_or_risk_notes": [],
    "pricing_or_packaging_notes": "",
    "competitors_mentioned": [],
    "objections_and_responses": [
      {
        "objection": "",
        "response": ""
      }
    ]
  },
  "value_stories": [
    {
      "title": "",
      "product": "",
      "customer_segment": "",
      "industry": "",
      "pain_point": "",
      "solution": "",
      "business_impact": "",
      "metrics": "",
      "proof_points": [],
      "objection_use_cases": []
    }
  ],
  "sales_talk_tracks": [
    {
      "scenario": "",
      "what_to_say": "",
      "why_it_works": ""
    }
  ],
  "discovery_questions": [],
  "qualification_questions": [],
  "demo_angles": [],
  "red_flags": [],
  "next_step_recommendations": []
}

Asset metadata:
Title: ${title}
Asset type: ${assetType}
Company or product: ${companyOrProduct}
Website URL: ${normalizedWebsiteUrl ?? ""}

Source text:
${rawText.slice(0, 45000)}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const rawClaudeText = textBlock?.text ?? "";
    const parsed = await parseOrRepairJson(rawClaudeText);

    const { data: assetRow, error: assetError } = await supabaseServer
      .from("sales_assets")
      .insert({
        title,
        asset_type: assetType,
        company_or_product: companyOrProduct,
        source_filename: sourceFilename,
        raw_text: rawText,
        summary_json: {
          ...parsed,
          website_url: normalizedWebsiteUrl,
          pages_scraped: pagesScraped,
        },
      })
      .select("id")
      .single();

    if (assetError) {
      console.error("Sales asset insert error:", assetError);
      throw new Error("Failed to save sales asset.");
    }

    const valueStories = parsed.value_stories ?? [];

    if (Array.isArray(valueStories) && valueStories.length > 0) {
      const rows = valueStories.map((story) => ({
        title: story.title || title,
        product: story.product || companyOrProduct,
        customer_segment: story.customer_segment || "",
        industry: story.industry || "",
        pain_point: story.pain_point || "",
        solution: story.solution || "",
        business_impact: story.business_impact || "",
        metrics: story.metrics || "",
        proof_points: story.proof_points || [],
        objection_use_cases: story.objection_use_cases || [],
        raw_source_asset_id: assetRow.id,
      }));

      const { error: storyError } = await supabaseServer
        .from("sales_value_stories")
        .insert(rows);

      if (storyError) {
        console.error("Sales value story insert error:", storyError);
        throw new Error("Asset saved, but value stories failed to save.");
      }
    }

    return NextResponse.json({
      success: true,
      assetId: assetRow.id,
      data: parsed,
      extractedCharacters: rawText.length,
      savedValueStories: Array.isArray(valueStories) ? valueStories.length : 0,
      websiteUrl: normalizedWebsiteUrl,
      pagesScraped,
    });
  } catch (error) {
    console.error("Sales ingest failed:", error);

    const message =
      error instanceof Error ? error.message : "Unknown sales ingest error";

    return NextResponse.json(
      {
        success: false,
        error: "Sales ingest failed.",
        details: message,
      },
      { status: 500 }
    );
  }
}