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

    const callIdFromClient = String(body.callId ?? "").trim();
    const transcript = String(body.transcript ?? "").trim();
    const latestProspectTurn = String(body.latestProspectTurn ?? "").trim();
    const prospectCompany = String(body.prospectCompany ?? "").trim();
    const prospectName = String(body.prospectName ?? "").trim();
    const callType = String(body.callType ?? "Discovery").trim();
    const opportunityStage = String(body.opportunityStage ?? "Early").trim();

    if (!transcript && !latestProspectTurn) {
      return NextResponse.json(
        {
          success: false,
          error: "Transcript or latest prospect turn is required.",
        },
        { status: 400 }
      );
    }

    const { data: assets, error: assetsError } = await supabaseServer
      .from("sales_assets")
      .select("title, asset_type, company_or_product, summary_json, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (assetsError) {
      console.error("Sales assets load error:", assetsError);
    }

    const { data: valueStories, error: storiesError } = await supabaseServer
      .from("sales_value_stories")
      .select(
        "title, product, customer_segment, industry, pain_point, solution, business_impact, metrics, proof_points, objection_use_cases, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(12);

    if (storiesError) {
      console.error("Sales value stories load error:", storiesError);
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `You are a live sales call copilot.

Your job is to help the seller move the conversation forward naturally. Do not just answer the prospect's question. Diagnose what is happening in the call, identify the buyer's intent, suggest what to say next, recommend discovery questions, surface relevant proof points, and flag qualification gaps.

Use these sales frameworks when helpful:
- SPIN: Situation, Problem, Implication, Need-payoff
- MEDDIC: Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion
- BANT: Budget, Authority, Need, Timeline
- Value selling: quantify pain, map solution to business outcome, support with proof
- Objection handling: acknowledge, clarify, reframe, support with evidence, ask a follow-up question

Rules:
- Do not invent product capabilities, metrics, customer names, or case studies.
- Use the sales assets and value stories only when relevant.
- If the prospect asks a direct question, give a concise suggested response.
- If the prospect reveals pain, suggest a discovery question that deepens the pain and quantifies impact.
- If the prospect raises an objection, give an objection-handling talk track.
- If qualification information is missing, identify it clearly.
- Keep the guidance glanceable for a live call.
- Return valid JSON only.
- Do not include markdown.
- Start with { and end with }.

Return this exact JSON structure:
{
  "conversation_stage": "",
  "prospect_intent": "",
  "detected_pain_points": [],
  "detected_objections": [],
  "buying_signals": [],
  "qualification_gaps": [],
  "suggested_response": "",
  "next_best_question": "",
  "value_story_to_use": "",
  "proof_points_to_mention": [],
  "talk_track_sections": [
    {
      "section_title": "",
      "what_to_say": "",
      "why_it_matters": ""
    }
  ],
  "things_to_avoid": [],
  "recommended_next_step": "",
  "crm_notes": {
    "summary": "",
    "pain_points": [],
    "stakeholders": [],
    "objections": [],
    "next_steps": []
  }
}

Call context:
Prospect company: ${prospectCompany}
Prospect name: ${prospectName}
Call type: ${callType}
Opportunity stage: ${opportunityStage}

Latest prospect turn:
${latestProspectTurn}

Transcript:
${transcript.slice(-12000)}

Sales assets:
${JSON.stringify(assets ?? [], null, 2)}

Value stories:
${JSON.stringify(valueStories ?? [], null, 2)}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const rawText = textBlock?.text ?? "";
    const jsonText = extractJsonFromText(rawText);
    const parsed = JSON.parse(jsonText);

    let callId = callIdFromClient || null;

    if (callId) {
      const { error: updateCallError } = await supabaseServer
        .from("sales_calls")
        .update({
          prospect_company: prospectCompany || null,
          prospect_name: prospectName || null,
          opportunity_stage: opportunityStage,
          call_type: callType,
          transcript,
          call_summary_json: parsed.crm_notes ?? parsed,
        })
        .eq("id", callId);

      if (updateCallError) {
        console.error("Sales call update error:", updateCallError);
        callId = null;
      }
    }

    if (!callId) {
      const { data: callRow, error: callError } = await supabaseServer
        .from("sales_calls")
        .insert({
          prospect_company: prospectCompany || null,
          prospect_name: prospectName || null,
          opportunity_stage: opportunityStage,
          call_type: callType,
          transcript,
          call_summary_json: parsed.crm_notes ?? parsed,
        })
        .select("id")
        .single();

      if (callError) {
        console.error("Sales call save error:", callError);
      } else {
        callId = callRow.id;
      }
    }

    if (callId) {
      const { error: cardSaveError } = await supabaseServer
        .from("sales_copilot_cards")
        .insert({
          call_id: callId,
          prospect_question: latestProspectTurn,
          card_json: parsed,
        });

      if (cardSaveError) {
        console.error("Sales copilot card save error:", cardSaveError);
      }
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      callId,
      model: "claude-sonnet-4-6",
    });
  } catch (error) {
    console.error("Sales copilot failed:", error);

    const message =
      error instanceof Error ? error.message : "Unknown sales copilot error";

    return NextResponse.json(
      {
        success: false,
        error: "Sales copilot failed.",
        details: message,
      },
      { status: 500 }
    );
  }
}