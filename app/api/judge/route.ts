import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    if (body.task === "phoneme") {
      return await judgePhoneme(body);
    }
    if (body.task === "phoneme_unit") {
      return await judgePhonemeUnit(body);
    }
    if (body.task === "reformulation") {
      return await judgeReformulation(body);
    }
    if (body.task === "rhythm") {
      return await judgeRhythm(body);
    }
    return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  } catch (err) {
    console.error("[judge]", err);
    return NextResponse.json({ error: "Judge failed" }, { status: 500 });
  }
}

async function judgePhoneme(body: {
  phoneme: string;
  gapDescription: string;
  refContext: string;
}) {
  if (!openai) {
    return NextResponse.json({
      score: 0.45,
      reasoning: "Live judge unavailable, fallback response.",
      prescription: body.gapDescription,
      source: "cached",
    });
  }

  const parsed = await askJson(
    "You are a speech therapist. Output JSON with score (0-1), reasoning (1 sentence), prescription (1 action sentence).",
    `Phoneme: /${body.phoneme}/\nDetected gap: ${body.gapDescription}\nReference context:\n${body.refContext}\nReturn valid JSON only.`,
    {
      score: 0.45,
      reasoning: "Fallback reasoning",
      prescription: body.gapDescription,
    }
  );

  return NextResponse.json({
    score: clamp01(parsed.score, 0.45),
    reasoning: asText(parsed.reasoning, "Fallback reasoning"),
    prescription: asText(parsed.prescription, body.gapDescription),
    source: "live",
  });
}

async function judgePhonemeUnit(body: {
  unitLabel: string;
  gapDescription: string;
  refContext: string;
}) {
  if (!openai) {
    return NextResponse.json({
      score: 0.45,
      reasoning: "Live judge unavailable, fallback response.",
      prescription: body.gapDescription,
      source: "cached",
    });
  }

  const parsed = await askJson(
    "You are a pronunciation coach. Output JSON with score (0-1), reasoning, prescription.",
    `Unit: ${body.unitLabel}\nGap: ${body.gapDescription}\nReferences:\n${body.refContext}\nFocus on actionable mouth-shape correction.`,
    {
      score: 0.45,
      reasoning: "Fallback reasoning",
      prescription: body.gapDescription,
    }
  );

  return NextResponse.json({
    score: clamp01(parsed.score, 0.45),
    reasoning: asText(parsed.reasoning, "Fallback reasoning"),
    prescription: asText(parsed.prescription, body.gapDescription),
    source: "live",
  });
}

async function judgeReformulation(body: {
  original: string;
  reformulation: string;
  rubric: string;
}) {
  if (!openai) {
    return NextResponse.json({
      score: 0.5,
      reasoning: "Live judge unavailable, fallback response.",
      source: "cached",
    });
  }

  const parsed = await askJson(
    `You are a ${body.rubric} coach. Return JSON { score: 0-1, reasoning: string }`,
    `Original: "${body.original}"\nReformulation: "${body.reformulation}"\nIs reformulation better?`,
    {
      score: 0.5,
      reasoning: "Fallback reasoning",
    }
  );

  return NextResponse.json({
    score: clamp01(parsed.score, 0.5),
    reasoning: asText(parsed.reasoning, "Fallback reasoning"),
    source: "live",
  });
}

async function judgeRhythm(body: {
  pattern: string;
  bpm: number;
  weakBeat: number;
  meanAbsDeviationMs: number;
  refs: string[];
}) {
  if (!openai) {
    const score = clamp01(1 - (body.meanAbsDeviationMs ?? 0) / 220, 0.5);
    return NextResponse.json({
      score,
      reasoning: "Fallback rhythm judge.",
      prescription: `Slow to ${Math.max(60, (body.bpm ?? 80) - 10)} BPM and isolate beat ${body.weakBeat + 1} with down-up metronome reps.`,
      source: "cached",
    });
  }

  const parsed = await askJson(
    "You are a guitar rhythm coach. Return JSON with score (0-1), reasoning, prescription (one sentence drill).",
    `Pattern: ${body.pattern}\nBPM: ${body.bpm}\nWeak beat index: ${body.weakBeat}\nMean absolute deviation ms: ${body.meanAbsDeviationMs}\nReferences:\n${(body.refs ?? []).join("\n")}\n`,
    {
      score: 0.5,
      reasoning: "Fallback reasoning",
      prescription: `Slow to ${Math.max(60, (body.bpm ?? 80) - 10)} BPM and isolate beat ${body.weakBeat + 1}.`,
    }
  );

  return NextResponse.json({
    score: clamp01(parsed.score, 0.5),
    reasoning: asText(parsed.reasoning, "Fallback reasoning"),
    prescription: asText(
      parsed.prescription,
      `Slow to ${Math.max(60, (body.bpm ?? 80) - 10)} BPM and isolate beat ${body.weakBeat + 1}.`
    ),
    source: "live",
  });
}

async function askJson<T extends Record<string, unknown>>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  if (!openai) return fallback;

  try {
    const one = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: `${system} Always output valid JSON.` },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: 320,
    });

    const raw = one.choices[0]?.message?.content ?? "{}";
    const parsed = toObject(JSON.parse(raw));
    return { ...fallback, ...parsed } as T;
  } catch {
    try {
      const two = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: `${system} Return strict JSON only.` },
          { role: "user", content: user + "\nReturn JSON now." },
        ],
        response_format: { type: "json_object" },
        max_tokens: 320,
      });

      const raw = two.choices[0]?.message?.content ?? "{}";
      const parsed = toObject(JSON.parse(raw));
      return { ...fallback, ...parsed } as T;
    } catch {
      return fallback;
    }
  }
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function asText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
