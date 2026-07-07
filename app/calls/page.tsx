"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SalesCall = {
  id: string;
  prospect_company: string | null;
  prospect_name: string | null;
  opportunity_stage: string | null;
  call_type: string | null;
  transcript: string | null;
  call_summary_json: {
    summary?: string;
    pain_points?: string[];
    stakeholders?: string[];
    objections?: string[];
    next_steps?: string[];
  } | null;
  created_at: string;
};

type SalesCard = {
  id: string;
  call_id: string;
  prospect_question: string | null;
  card_json: {
    conversation_stage?: string;
    prospect_intent?: string;
    detected_pain_points?: string[];
    detected_objections?: string[];
    buying_signals?: string[];
    qualification_gaps?: string[];
    suggested_response?: string;
    next_best_question?: string;
    recommended_next_step?: string;
    crm_notes?: {
      summary?: string;
      pain_points?: string[];
      stakeholders?: string[];
      objections?: string[];
      next_steps?: string[];
    };
  } | null;
  created_at: string;
};

export default function CallsPage() {
  const [calls, setCalls] = useState<SalesCall[]>([]);
  const [cardsByCallId, setCardsByCallId] = useState<Record<string, SalesCard[]>>(
    {}
  );
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedCall = calls.find((call) => call.id === selectedCallId) ?? null;
  const selectedCards = selectedCallId ? cardsByCallId[selectedCallId] ?? [] : [];

  useEffect(() => {
    loadCalls();
  }, []);

  async function loadCalls() {
    setLoading(true);
    setError("");

    try {
      const { data: callsData, error: callsError } = await supabase
        .from("sales_calls")
        .select(
          "id, prospect_company, prospect_name, opportunity_stage, call_type, transcript, call_summary_json, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (callsError) {
        throw callsError;
      }

      const loadedCalls = (callsData ?? []) as SalesCall[];
      setCalls(loadedCalls);

      if (loadedCalls.length > 0) {
        setSelectedCallId(loadedCalls[0].id);
      }

      const callIds = loadedCalls.map((call) => call.id);

      if (callIds.length > 0) {
        const { data: cardsData, error: cardsError } = await supabase
          .from("sales_copilot_cards")
          .select("id, call_id, prospect_question, card_json, created_at")
          .in("call_id", callIds)
          .order("created_at", { ascending: false });

        if (cardsError) {
          throw cardsError;
        }

        const groupedCards = ((cardsData ?? []) as SalesCard[]).reduce<
          Record<string, SalesCard[]>
        >((acc, card) => {
          if (!acc[card.call_id]) {
            acc[card.call_id] = [];
          }

          acc[card.call_id].push(card);
          return acc;
        }, {});

        setCardsByCallId(groupedCards);
      }
    } catch (err) {
      console.error("Failed to load calls:", err);
      setError(err instanceof Error ? err.message : "Failed to load calls.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateString));
  }

  function renderList(items?: string[]) {
    if (!items || items.length === 0) {
      return <p className="text-sm text-gray-500">None captured yet.</p>;
    }

    return (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Saved Calls</h1>
            <p className="mt-2 max-w-3xl text-gray-600">
              Review generated call notes, detected objections, pain points,
              buying signals, and suggested follow-ups from Sales Copilot.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/copilot"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Sales Copilot
            </a>

            <button
              onClick={loadCalls}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading && (
          <p className="mt-6 rounded-lg bg-white p-4 text-sm text-gray-600 shadow-sm">
            Loading saved calls...
          </p>
        )}

        {error && (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {!loading && calls.length === 0 && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              No saved calls yet
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Generate guidance from the Sales Copilot page and the call notes
              will appear here.
            </p>
          </div>
        )}

        {!loading && calls.length > 0 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="px-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Recent Calls
              </h2>

              <div className="mt-3 grid gap-2">
                {calls.map((call) => {
                  const isSelected = call.id === selectedCallId;
                  const cardCount = cardsByCallId[call.id]?.length ?? 0;

                  return (
                    <button
                      key={call.id}
                      onClick={() => setSelectedCallId(call.id)}
                      className={`rounded-lg border p-4 text-left transition ${
                        isSelected
                          ? "border-gray-900 bg-gray-100"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {call.prospect_company || "Unknown company"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {call.call_type || "Call"} ·{" "}
                            {call.opportunity_stage || "Stage unknown"}
                          </p>
                        </div>

                        <span className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-700">
                          {cardCount}
                        </span>
                      </div>

                      <p className="mt-3 text-xs text-gray-500">
                        {formatDate(call.created_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedCall && (
              <div className="grid gap-6">
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedCall.prospect_company || "Unknown company"}
                      </h2>

                      <p className="mt-1 text-sm text-gray-600">
                        {selectedCall.call_type || "Call"} ·{" "}
                        {selectedCall.opportunity_stage || "Stage unknown"} ·{" "}
                        {formatDate(selectedCall.created_at)}
                      </p>

                      {selectedCall.prospect_name && (
                        <p className="mt-1 text-sm text-gray-600">
                          Prospect: {selectedCall.prospect_name}
                        </p>
                      )}
                    </div>

                    <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                      {selectedCards.length} guidance card
                      {selectedCards.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-6 rounded-lg bg-gray-50 p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Summary
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-800">
                      {selectedCall.call_summary_json?.summary ||
                        "No summary captured."}
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Pain Points
                      </h3>
                      {renderList(selectedCall.call_summary_json?.pain_points)}
                    </div>

                    <div className="rounded-lg border p-5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Objections
                      </h3>
                      {renderList(selectedCall.call_summary_json?.objections)}
                    </div>

                    <div className="rounded-lg border p-5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Stakeholders
                      </h3>
                      {renderList(selectedCall.call_summary_json?.stakeholders)}
                    </div>

                    <div className="rounded-lg border p-5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Next Steps
                      </h3>
                      {renderList(selectedCall.call_summary_json?.next_steps)}
                    </div>
                  </div>
                </div>

                {selectedCards.length > 0 && (
                  <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Guidance Cards
                    </h2>

                    <div className="mt-4 grid gap-4">
                      {selectedCards.map((card) => (
                        <div key={card.id} className="rounded-lg border p-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {card.card_json?.conversation_stage ||
                                  "Sales guidance"}
                              </h3>
                              <p className="mt-1 text-xs text-gray-500">
                                {formatDate(card.created_at)}
                              </p>
                            </div>

                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                              {card.card_json?.prospect_intent ||
                                "Intent unknown"}
                            </span>
                          </div>

                          {card.prospect_question && (
                            <div className="mt-4 rounded-lg bg-gray-50 p-4">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Prospect Question / Objection
                              </h4>
                              <p className="mt-2 text-sm text-gray-800">
                                {card.prospect_question}
                              </p>
                            </div>
                          )}

                          <div className="mt-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Suggested Response
                            </h4>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                              {card.card_json?.suggested_response ||
                                "No suggested response saved."}
                            </p>
                          </div>

                          <div className="mt-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Next Best Question
                            </h4>
                            <p className="mt-2 text-sm leading-6 text-gray-800">
                              {card.card_json?.next_best_question ||
                                "No next question saved."}
                            </p>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Buying Signals
                              </h4>
                              {renderList(card.card_json?.buying_signals)}
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Qualification Gaps
                              </h4>
                              {renderList(card.card_json?.qualification_gaps)}
                            </div>
                          </div>

                          {card.card_json?.recommended_next_step && (
                            <div className="mt-4 rounded-lg bg-gray-50 p-4">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Recommended Next Step
                              </h4>
                              <p className="mt-2 text-sm text-gray-800">
                                {card.card_json.recommended_next_step}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCall.transcript && (
                  <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Transcript
                    </h2>
                    <p className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                      {selectedCall.transcript}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}