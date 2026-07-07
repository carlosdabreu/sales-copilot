"use client";

import { useEffect, useRef, useState } from "react";

type SalesCopilotCard = {
  conversation_stage: string;
  prospect_intent: string;
  detected_pain_points: string[];
  detected_objections: string[];
  buying_signals: string[];
  qualification_gaps: string[];
  suggested_response: string;
  next_best_question: string;
  value_story_to_use: string;
  proof_points_to_mention: string[];
  talk_track_sections: {
    section_title: string;
    what_to_say: string;
    why_it_matters: string;
  }[];
  things_to_avoid: string[];
  recommended_next_step: string;
  crm_notes: {
    summary: string;
    pain_points: string[];
    stakeholders: string[];
    objections: string[];
    next_steps: string[];
  };
};

type FinalCallSummary = {
  executive_summary: string;
  call_outcome: string;
  pain_points: string[];
  business_impact: string[];
  objections: string[];
  buying_signals: string[];
  risks: string[];
  stakeholders: string[];
  qualification_gaps: string[];
  recommended_next_steps: string[];
  meddic: {
    metrics: string;
    economic_buyer: string;
    decision_criteria: string;
    decision_process: string;
    identify_pain: string;
    champion: string;
  };
  bant: {
    budget: string;
    authority: string;
    need: string;
    timeline: string;
  };
  follow_up_email: {
    subject: string;
    body: string;
  };
};

function getSupportedAudioConfig() {
  const options = [
    {
      mimeType: "audio/webm;codecs=opus",
      extension: "webm",
    },
    {
      mimeType: "audio/webm",
      extension: "webm",
    },
    {
      mimeType: "audio/mp4",
      extension: "mp4",
    },
    {
      mimeType: "audio/mpeg",
      extension: "mp3",
    },
  ];

  for (const option of options) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(option.mimeType)
    ) {
      return option;
    }
  }

  return {
    mimeType: "",
    extension: "webm",
  };
}

export default function SalesCopilotPage() {
  const [prospectCompany, setProspectCompany] = useState("");
  const [callType, setCallType] = useState("Discovery");
  const [opportunityStage, setOpportunityStage] = useState("Early");
  const [latestProspectTurn, setLatestProspectTurn] = useState("");
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [card, setCard] = useState<SalesCopilotCard | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [finalSummary, setFinalSummary] = useState<FinalCallSummary | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningStatus, setListeningStatus] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const lastAutoTurnRef = useRef("");
  const cardRef = useRef<HTMLDivElement | null>(null);
  const finalSummaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (card) {
      cardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [card]);

  useEffect(() => {
    if (finalSummary) {
      finalSummaryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [finalSummary]);

  function looksLikeProspectMoment(text: string) {
    const lower = text.toLowerCase().trim();

    return (
      lower.endsWith("?") ||
      lower.includes("how much") ||
      lower.includes("what does it cost") ||
      lower.includes("pricing") ||
      lower.includes("budget") ||
      lower.includes("roi") ||
      lower.includes("business case") ||
      lower.includes("we already have") ||
      lower.includes("we use") ||
      lower.includes("competitor") ||
      lower.includes("not sure") ||
      lower.includes("concern") ||
      lower.includes("security") ||
      lower.includes("implementation") ||
      lower.includes("integration") ||
      lower.includes("timeline") ||
      lower.includes("decision") ||
      lower.includes("approval") ||
      lower.includes("procurement") ||
      lower.includes("send me") ||
      lower.includes("next steps") ||
      lower.startsWith("can you") ||
      lower.startsWith("could you") ||
      lower.startsWith("what") ||
      lower.startsWith("why") ||
      lower.startsWith("how")
    );
  }

  function getLikelyLatestProspectTurn(fullTranscript: string) {
    const cleanedTranscript = fullTranscript.trim();

    const pieces = cleanedTranscript
      .split(/(?<=[.?!])\s+/)
      .map((piece) => piece.trim())
      .filter(Boolean);

    if (pieces.length === 0) return "";

    const prospectMomentIndex = pieces.findLastIndex((piece) =>
      looksLikeProspectMoment(piece)
    );

    if (prospectMomentIndex === -1) return "";

    const contextStart = Math.max(0, prospectMomentIndex - 2);
    return pieces.slice(contextStart, prospectMomentIndex + 1).join(" ");
  }

  async function transcribeAudioChunk(audioBlob: Blob, extension: string) {
    const formData = new FormData();
    formData.append("audio", audioBlob, `sales-call-chunk.${extension}`);

    const response = await fetch("/api/transcribe-audio", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("Transcription error:", result);
      throw new Error(result.error || result.details || "Transcription failed.");
    }

    setDebugInfo(
      `Last chunk transcribed. Type: ${audioBlob.type || "unknown"} | Size: ${audioBlob.size} bytes`
    );

    return result.text as string;
  }

  async function generateSalesGuidanceForTurn(
    prospectTurn: string,
    transcriptText: string
  ) {
    setLoading(true);
    setError("");
    setCard(null);

    try {
      const response = await fetch("/api/sales-copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callId: currentCallId,
          prospectCompany,
          callType,
          opportunityStage,
          latestProspectTurn: prospectTurn,
          transcript: transcriptText,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Sales copilot error:", result);
        throw new Error(
          result.error || result.details || "Something went wrong."
        );
      }

      setCard(result.data);

      if (result.callId) {
        setCurrentCallId(result.callId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTranscribedText(text: string) {
    const cleanedText = text.trim();

    if (!cleanedText) {
      setDebugInfo("Last chunk returned no transcript text.");
      return;
    }

    const nextTranscript =
      `${accumulatedTranscriptRef.current} ${cleanedText}`.trim();

    accumulatedTranscriptRef.current = nextTranscript;
    setLiveTranscript(nextTranscript);
    setTranscript(nextTranscript);

    const detectedTurn = getLikelyLatestProspectTurn(nextTranscript);

    if (
      detectedTurn &&
      detectedTurn.length > 12 &&
      detectedTurn !== lastAutoTurnRef.current
    ) {
      lastAutoTurnRef.current = detectedTurn;
      setLatestProspectTurn(detectedTurn);
      await generateSalesGuidanceForTurn(detectedTurn, nextTranscript);
    }
  }

  function recordNextChunk(stream: MediaStream) {
    if (!shouldKeepListeningRef.current) return;

    const audioConfig = getSupportedAudioConfig();

    const recorderOptions =
      audioConfig.mimeType.length > 0
        ? {
            mimeType: audioConfig.mimeType,
          }
        : undefined;

    let mediaRecorder: MediaRecorder;

    try {
      mediaRecorder = new MediaRecorder(stream, recorderOptions);
    } catch (err) {
      console.error("MediaRecorder creation failed:", err);
      setError(
        "Could not start audio recorder. Try Chrome if you are using Safari."
      );
      stopListening();
      return;
    }

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (!shouldKeepListeningRef.current && chunks.length === 0) return;

      if (chunks.length === 0) {
        setDebugInfo("No audio captured in last chunk.");
        if (shouldKeepListeningRef.current) {
          window.setTimeout(() => recordNextChunk(stream), 500);
        }
        return;
      }

      const audioBlob = new Blob(chunks, {
        type: audioConfig.mimeType || "audio/webm",
      });

      try {
        setListeningStatus("Transcribing latest audio chunk...");
        const text = await transcribeAudioChunk(audioBlob, audioConfig.extension);
        setListeningStatus("Listening for prospect questions and objections...");
        await handleTranscribedText(text);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "Audio transcription failed."
        );
      } finally {
        if (shouldKeepListeningRef.current) {
          window.setTimeout(() => recordNextChunk(stream), 500);
        }
      }
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();

    setDebugInfo(
      `Recording chunk using ${audioConfig.mimeType || "browser default audio format"}...`
    );

    window.setTimeout(() => {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, 10000);
  }

  async function startListening() {
    try {
      setError("");
      setCard(null);
      setFinalSummary(null);
      setCurrentCallId(null);
      setLiveTranscript("");
      setTranscript("");
      setLatestProspectTurn("");
      setDebugInfo("");
      accumulatedTranscriptRef.current = "";
      lastAutoTurnRef.current = "";

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      shouldKeepListeningRef.current = true;

      setIsListening(true);
      setListeningStatus("Listening for prospect questions and objections...");

      recordNextChunk(stream);
    } catch (err) {
      console.error("Mic capture failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not access microphone. Check browser permissions."
      );
      setIsListening(false);
      setListeningStatus("");
      shouldKeepListeningRef.current = false;
    }
  }

  function stopListening() {
    shouldKeepListeningRef.current = false;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;

    setIsListening(false);
    setListeningStatus("");
  }

  async function generateSalesGuidance() {
    await generateSalesGuidanceForTurn(latestProspectTurn, transcript);
  }

  async function finalizeCall() {
    if (!currentCallId) {
      setError("Generate at least one guidance card before finalizing the call.");
      return;
    }

    setFinalizing(true);
    setError("");

    try {
      stopListening();

      const response = await fetch("/api/finalize-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callId: currentCallId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Finalize call error:", result);
        throw new Error(result.error || result.details || "Could not finalize call.");
      }

      setFinalSummary(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown finalize error.");
    } finally {
      setFinalizing(false);
    }
  }

  function clearSession() {
    stopListening();
    setLiveTranscript("");
    setTranscript("");
    setLatestProspectTurn("");
    setCard(null);
    setFinalSummary(null);
    setCurrentCallId(null);
    setDebugInfo("");
    setError("");
    accumulatedTranscriptRef.current = "";
    lastAutoTurnRef.current = "";
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
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales Copilot</h1>
            <p className="mt-2 max-w-3xl text-gray-600">
              Listen to a sales conversation, detect prospect questions and
              objections, and generate live guidance grounded in your Sales
              Knowledge Library.
            </p>
          </div>

          <a
            href="/library"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Sales Library
          </a>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Prospect Company
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-gray-900"
                placeholder="Example: Acme Corp"
                value={prospectCompany}
                onChange={(event) => setProspectCompany(event.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Call Type
              </label>
              <select
                className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-gray-900"
                value={callType}
                onChange={(event) => setCallType(event.target.value)}
              >
                <option>Discovery</option>
                <option>Demo</option>
                <option>Technical Validation</option>
                <option>Security Review</option>
                <option>Pricing / Commercial</option>
                <option>Renewal / Expansion</option>
                <option>Executive Alignment</option>
                <option>Objection Handling</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Opportunity Stage
              </label>
              <select
                className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-gray-900"
                value={opportunityStage}
                onChange={(event) => setOpportunityStage(event.target.value)}
              >
                <option>Early</option>
                <option>Qualified</option>
                <option>Evaluation</option>
                <option>Proposal</option>
                <option>Procurement</option>
                <option>Closed Won</option>
                <option>Closed Lost</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={startListening}
              disabled={isListening}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isListening ? "Listening..." : "Start Chunk Listening"}
            </button>

            <button
              onClick={stopListening}
              disabled={!isListening}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              Stop Listening
            </button>

            <button
              onClick={finalizeCall}
              disabled={!currentCallId || finalizing}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {finalizing ? "Finalizing Call..." : "Finalize Call"}
            </button>

            <button
              onClick={clearSession}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900"
            >
              Clear
            </button>
          </div>

          {listeningStatus && (
            <p className="mt-3 text-sm text-gray-500">{listeningStatus}</p>
          )}

          {debugInfo && (
            <p className="mt-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
              {debugInfo}
            </p>
          )}

          {currentCallId && (
            <p className="mt-2 text-xs text-gray-500">
              Active call session saved.
            </p>
          )}

          {loading && (
            <p className="mt-3 text-sm font-medium text-gray-700">
              Generating sales guidance...
            </p>
          )}

          {liveTranscript && (
            <div className="mt-5 rounded-lg bg-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Live Transcript
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                {liveTranscript}
              </p>
            </div>
          )}

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Detected / Manual Prospect Question or Objection
            </label>
            <textarea
              className="mt-2 min-h-[120px] w-full rounded-lg border border-gray-300 p-4 text-sm text-gray-900 outline-none focus:border-gray-900"
              placeholder="Example: We already have a tool for this, and I’m not sure there’s enough ROI to justify switching."
              value={latestProspectTurn}
              onChange={(event) => setLatestProspectTurn(event.target.value)}
            />
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Full / Partial Transcript
            </label>
            <textarea
              className="mt-2 min-h-[220px] w-full rounded-lg border border-gray-300 p-4 text-sm text-gray-900 outline-none focus:border-gray-900"
              placeholder="Transcript will appear here automatically, or you can paste manually..."
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
            />
          </div>

          <button
            onClick={generateSalesGuidance}
            disabled={
              loading ||
              (latestProspectTurn.trim().length === 0 &&
                transcript.trim().length === 0)
            }
            className="mt-5 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "Generating Guidance..." : "Generate Sales Guidance"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        {finalSummary && (
          <div
            ref={finalSummaryRef}
            className="mt-6 rounded-xl border bg-white p-6 shadow-sm"
          >
            <h2 className="text-2xl font-bold text-gray-900">
              Final Call Summary
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-700">
              {finalSummary.executive_summary}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Call Outcome
                </h3>
                <p className="mt-2 text-sm text-gray-800">
                  {finalSummary.call_outcome}
                </p>
              </div>

              <div className="rounded-lg border p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Recommended Next Steps
                </h3>
                {renderList(finalSummary.recommended_next_steps)}
              </div>

              <div className="rounded-lg border p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Pain Points
                </h3>
                {renderList(finalSummary.pain_points)}
              </div>

              <div className="rounded-lg border p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Objections
                </h3>
                {renderList(finalSummary.objections)}
              </div>
            </div>

            <div className="mt-6 rounded-lg border p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Follow-Up Email Draft
              </h3>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                Subject: {finalSummary.follow_up_email?.subject}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {finalSummary.follow_up_email?.body}
              </p>
            </div>
          </div>
        )}

        {card && (
          <div ref={cardRef} className="mt-6 grid gap-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Live Sales Guidance
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Stage: {card.conversation_stage} | Intent:{" "}
                    {card.prospect_intent}
                  </p>
                </div>

                <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                  {callType}
                </span>
              </div>

              <div className="mt-6 rounded-lg border p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Suggested Response
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-gray-900">
                  {card.suggested_response}
                </p>
              </div>

              <div className="mt-6 rounded-lg bg-gray-50 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Next Best Question
                </h3>
                <p className="mt-2 text-base text-gray-900">
                  {card.next_best_question}
                </p>
              </div>

              {card.talk_track_sections?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Talk Track
                  </h3>
                  <div className="mt-3 grid gap-4">
                    {card.talk_track_sections.map((section, index) => (
                      <div
                        key={`talk-track-${index}`}
                        className="rounded-lg border p-4"
                      >
                        <h4 className="font-semibold text-gray-900">
                          {section.section_title}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-gray-800">
                          {section.what_to_say}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-gray-500">
                          Why it matters: {section.why_it_matters}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {card.value_story_to_use && (
                <div className="mt-6 rounded-lg border p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Value Story to Use
                  </h3>
                  <p className="mt-2 text-base text-gray-900">
                    {card.value_story_to_use}
                  </p>

                  {card.proof_points_to_mention?.length > 0 && (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
                      {card.proof_points_to_mention.map((point, index) => (
                        <li key={`proof-point-${index}`}>{point}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}