import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;
  const referenceText = String(formData.get("referenceText") ?? "").trim();

  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 500 });
  }

  const upstream = new FormData();
  upstream.append("model_id", "scribe_v2");
  upstream.append("file", audioFile);
  upstream.append("language_code", "eng");
  upstream.append("timestamps_granularity", "word");
  upstream.append("tag_audio_events", "false");

  for (const keyterm of buildKeyterms(referenceText)) {
    upstream.append("keyterms", keyterm);
  }

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: upstream,
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[transcribe] ElevenLabs error:", body);
    return NextResponse.json(
      { error: "ElevenLabs STT failed", detail: body },
      { status: res.status }
    );
  }

  const data = await res.json();

  return NextResponse.json({
    transcript: data.text ?? data.transcript ?? "",
    words: data.words ?? [],
  });
}

function buildKeyterms(referenceText: string): string[] {
  if (!referenceText) return [];

  const seen = new Set<string>();
  const terms: string[] = [];

  for (const raw of referenceText.split(/\s+/)) {
    const term = raw.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, "");
    if (term.length < 2 || term.length > 50) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= 50) break;
  }

  return terms;
}
