import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type Mode = "pitch" | "concept" | "present";
type Segment = {
  phrase: string;
  kind: "hedge" | "filler" | "load-bearing" | "jargon" | "neutral";
  impact: number;
};

type ParsedSegment = {
  phrase?: unknown;
  kind?: unknown;
  impact?: unknown;
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    if (body.task === "identify") {
      return await identify(body.transcript, body.mode);
    }
    if (body.task === "counterfactual") {
      return await counterfactual(body.transcript, body.phraseToRemove, body.mode);
    }
    return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  } catch (err) {
    console.error("[ablate]", err);
    return NextResponse.json({ error: "Ablation failed" }, { status: 500 });
  }
}

async function identify(transcript: string, mode: Mode) {
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ segments: [] });
  }

  if (!openai) {
    return NextResponse.json({ segments: fallbackSegments(transcript), source: "cached" });
  }

  const system =
    `You are a ${mode} speaking coach. ` +
    "Return strict JSON with key 'segments'. " +
    "Each segment must include phrase, kind, impact. " +
    "kind must be hedge|filler|load-bearing|jargon|neutral. " +
    "impact must be 0 to 1 where high means this phrase likely hurts delivery if unchanged.";

  const user =
    `Transcript: ${transcript}\n` +
    "Identify the most meaningful coaching phrases (max 8). Return JSON only.";

  const parsed = await createJsonWithRetry(system, user, { segments: fallbackSegments(transcript) });
  const parsedRecord = asRecord(parsed);

  const rawSegments = Array.isArray(parsedRecord.segments)
    ? parsedRecord.segments
    : [];

  const segments: Segment[] = rawSegments
    .map((segment): Segment => {
      const s = asRecord(segment) as ParsedSegment;
      const kindValue = typeof s.kind === "string" ? s.kind : "neutral";
      return {
        phrase: typeof s.phrase === "string" ? s.phrase.trim() : "",
        kind: ["hedge", "filler", "load-bearing", "jargon", "neutral"].includes(kindValue)
          ? (kindValue as Segment["kind"])
        : "neutral",
        impact:
          typeof s.impact === "number"
            ? Math.max(0, Math.min(1, s.impact))
            : 0.35,
      };
    })
    .filter((s) => s.phrase.length > 0)
    .slice(0, 8);

  return NextResponse.json({
    segments: segments.length > 0 ? segments : fallbackSegments(transcript),
    source: "live",
  });
}

async function counterfactual(transcript: string, phraseToRemove: string, mode: Mode) {
  if (!transcript || !phraseToRemove) {
    return NextResponse.json(
      {
        output: transcript || "",
        score: 0.5,
        reasoning: "Missing input",
        source: "cached",
      },
      { status: 200 }
    );
  }

  if (!openai) {
    const output = removePhrase(transcript, phraseToRemove);
    return NextResponse.json({
      output,
      score: 0.55,
      reasoning: "Fallback rewrite used",
      source: "cached",
    });
  }

  const system =
    `You are a ${mode} coach. ` +
    "Return strict JSON with keys output, score, reasoning. " +
    "output must remove the problematic phrase naturally while preserving intent. " +
    "score is 0-1 where 1 means clearly better. reasoning must be one sentence.";

  const user =
    `Original transcript: ${transcript}\n` +
    `Phrase to remove: ${phraseToRemove}\n` +
    "Produce the counterfactual rewrite and score.";

  const fallback = {
    output: removePhrase(transcript, phraseToRemove),
    score: 0.55,
    reasoning: "Fallback rewrite used",
  };

  const parsed = await createJsonWithRetry(system, user, fallback);
  const parsedRecord = asRecord(parsed);
  const output =
    typeof parsedRecord.output === "string" && parsedRecord.output.trim().length > 0
      ? parsedRecord.output.trim()
      : fallback.output;
  const score =
    typeof parsedRecord.score === "number"
      ? Math.max(0, Math.min(1, parsedRecord.score))
      : fallback.score;
  const reasoning =
    typeof parsedRecord.reasoning === "string" && parsedRecord.reasoning.trim().length > 0
      ? parsedRecord.reasoning.trim()
      : fallback.reasoning;

  return NextResponse.json({ output, score, reasoning, source: "live" });
}

async function createJsonWithRetry(system: string, user: string, fallback: unknown): Promise<unknown> {
  try {
    const first = await openai!.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
    });

    const text = first.choices[0]?.message?.content ?? "{}";
    return JSON.parse(text);
  } catch {
    try {
      const second = await openai!.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: system + " Always output valid JSON." },
          { role: "user", content: user + " Output JSON only." },
        ],
        response_format: { type: "json_object" },
        max_tokens: 600,
      });

      const text = second.choices[0]?.message?.content ?? "{}";
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function fallbackSegments(transcript: string): Segment[] {
  const words = transcript
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const filler = new Set(["um", "uh", "like", "actually", "basically"]);
  const hedge = new Set(["maybe", "probably", "kind", "sort", "guess"]);

  const segments: Segment[] = [];

  for (const w of words) {
    const cleaned = w.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, "");
    const lower = cleaned.toLowerCase();
    if (!cleaned) continue;

    if (filler.has(lower)) {
      segments.push({ phrase: cleaned, kind: "filler", impact: 0.82 });
    } else if (hedge.has(lower)) {
      segments.push({ phrase: cleaned, kind: "hedge", impact: 0.72 });
    } else if (lower.length > 10) {
      segments.push({ phrase: cleaned, kind: "jargon", impact: 0.58 });
    }
  }

  if (segments.length === 0) {
    return words.slice(0, Math.min(4, words.length)).map((w) => ({
      phrase: w,
      kind: "neutral",
      impact: 0.2,
    }));
  }

  return segments.slice(0, 8);
}

function removePhrase(transcript: string, phrase: string): string {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const output = transcript.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  const normalized = output.replace(/\s+/g, " ").trim();
  return normalized || transcript;
}
