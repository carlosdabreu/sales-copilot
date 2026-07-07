import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const callId = String(body.callId ?? "").trim();

    if (!callId) {
      return NextResponse.json(
        { success: false, error: "callId is required." },
        { status: 400 }
      );
    }

    const { data: call, error: callError } = await supabaseServer
      .from("sales_calls")
      .select(
        "id, prospect_company, prospect_name, opportunity_stage, call_type, transcript, call_summary_json, created_at"
      )
      .eq("id", callId)
      .single();

    if (callError || !call) {
      console.error("Call load error:", callError);
      return NextResponse.json(
        { success: false, error: "Could not load call." },
        { status: 404 }
      );
    }

    const { data: cards, error: cardsError } = await supabaseServer
      .from("sales_copilot_cards")
      .select("prospect_question, card_json, created_at")
      .eq("call_id", callId)
      .order("created_at", { ascending: true });

    if (cardsError) {
      console.error("Cards load error:", cardsError);
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 5000,
      messages: [
        {
          role: "user",
          content: `You are a sales operations chief of staff.

Create a clean end-of-call summary from this sales call. The output should be useful for a seller, sales manager, and CRM update.

Rules:
- Do not invent facts.
- If something is unknown, say "Unknown" or use an empty array.
- Keep the follow-up email professional and concise.
- Use the transcript and generated guidance cards as source material.
- Return valid JSON only.
- Do not include markdown.
- Start with { and end with }.

Return this exact JSON structure:
{
  "executive_summary": "",
  "call_outcome": "",
  "prospect_company": "",
  "prospect_name": "",
  "call_type": "",
  "opportunity_stage": "",
  "pain_points": [],
  "business_impact": [],
  "objections": [],
  "buying_signals": [],
  "risks": [],
  "stakeholders": [],
  "meddic": {
    "metrics": "",
    "economic_buyer": "",
    "decision_criteria": "",
    "decision_process": "",
    "identify_pain": "",
    "champion": ""
  },
  "bant": {
    "budget": "",
    "authority": "",
    "need": "",
    "timeline": ""
  },
  "qualification_gaps": [],
  "recommended_next_steps": [],
  "crm_update": {
    "summary": "",
    "pain_points": [],
    "objections": [],
    "next_steps": [],
    "follow_up_required": true
  },
  "follow_up_email": {
    "subject": "",
    "body": ""
  }
}

Call metadata:
Prospect company: ${call.prospect_company ?? ""}
Prospect name: ${call.prospect_name ?? ""}
Call type: ${call.call_type ?? ""}
Opportunity stage: ${call.opportunity_stage ?? ""}

Transcript:
${String(call.transcript ?? "").slice(-18000)}

Guidance cards:
${JSON.stringify(cards ?? [], null, 2)}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const rawText = textBlock?.text ?? "";
    const jsonText = extractJsonFromText(rawText);
    const parsed = JSON.parse(jsonText);

    const { error: updateError } = await supabaseServer
      .from("sales_calls")
      .update({
        call_summary_json: parsed,
      })
      .eq("id", callId);

    if (updateError) {
      console.error("Finalize call update error:", updateError);
      throw new Error("Final summary generated but failed to save.");
    }

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error("Finalize call failed:", error);

    const message =
      error instanceof Error ? error.message : "Unknown finalize call error";

    return NextResponse.json(
      {
        success: false,
        error: "Finalize call failed.",
        details: message,
      },
      { status: 500 }
    );
  }
}