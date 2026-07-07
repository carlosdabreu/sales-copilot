import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Audio file is required." },
        { status: 400 }
      );
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "gpt-4o-mini-transcribe",
    });

    return NextResponse.json({
      success: true,
      text: transcription.text,
      model: "gpt-4o-mini-transcribe",
    });
  } catch (error) {
    console.error("Audio transcription failed:", error);

    const message =
      error instanceof Error ? error.message : "Unknown transcription error";

    return NextResponse.json(
      {
        success: false,
        error: "Audio transcription failed.",
        details: message,
      },
      { status: 500 }
    );
  }
}