import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type Mode = "pitch" | "concept" | "present";

const prewarmPool: Array<{ id: string; createdAt: number }> = [];

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    if (body.task === "prewarm") {
      const n = Math.max(1, Math.min(6, Number(body.n) || 2));
      for (let i = 0; i < n; i++) {
        prewarmPool.push({ id: crypto.randomUUID(), createdAt: Date.now() });
      }
      return NextResponse.json({ ok: true, warmed: n, poolSize: prewarmPool.length });
    }

    if (body.task === "ablate") {
      return await runAblation(
        String(body.transcript ?? ""),
        String(body.phraseToRemove ?? ""),
        body.mode as Mode
      );
    }

    return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  } catch (err) {
    console.error("[daytona]", err);
    return NextResponse.json({ error: "Sandbox route failed" }, { status: 500 });
  }
}

async function runAblation(transcript: string, phrase: string, mode: Mode) {
  const sandbox = prewarmPool.shift() ?? { id: crypto.randomUUID(), createdAt: Date.now() };

  if (!openai || !transcript || !phrase) {
    const output = removePhrase(transcript, phrase);
    return NextResponse.json({
      sandboxId: sandbox.id,
      output,
      score: 0.5,
      reasoning: "Fallback sandbox output",
      source: "cached",
    });
  }

  const prompt =
    `You are a ${mode} coach running in a sandbox. ` +
    "Return JSON {output, score, reasoning}. output should remove the phrase naturally while preserving meaning. " +
    "score is 0-1 where 1 is better delivery. reasoning is one sentence.\n\n" +
    `Transcript: ${transcript}\nPhrase to remove: ${phrase}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "Output must be valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 450,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json({
      sandboxId: sandbox.id,
      output:
        typeof parsed.output === "string" && parsed.output.trim().length > 0
          ? parsed.output.trim()
          : removePhrase(transcript, phrase),
      score:
        typeof parsed.score === "number"
          ? Math.max(0, Math.min(1, parsed.score))
          : 0.55,
      reasoning:
        typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
          ? parsed.reasoning.trim()
          : "No reasoning returned",
      source: "live",
    });
  } catch {
    const output = removePhrase(transcript, phrase);
    return NextResponse.json({
      sandboxId: sandbox.id,
      output,
      score: 0.5,
      reasoning: "Fallback sandbox output",
      source: "cached",
    });
  }
}

function removePhrase(transcript: string, phrase: string): string {
  if (!phrase.trim()) return transcript;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const output = transcript.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  const normalized = output.replace(/\s+/g, " ").trim();
  return normalized || transcript;
}
