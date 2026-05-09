export type JudgeResult = {
  score: number;
  reasoning: string;
  prescription: string;
  source?: "live" | "cached";
};

export async function scorePhonemePronunciation(
  phoneme: string,
  gapDescription: string,
  referenceSnippets: string[]
): Promise<JudgeResult> {
  const refContext = referenceSnippets.slice(0, 2).join("\n");

  const res = await fetch("/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: "phoneme",
      phoneme,
      gapDescription,
      refContext,
    }),
  });

  if (!res.ok) {
    return {
      score: 0.4,
      reasoning: "Judge unavailable",
      prescription: gapDescription,
      source: "cached",
    };
  }

  return res.json();
}

export async function scorePhonemeUnit(
  unitLabel: string,
  gapDescription: string,
  referenceSnippets: string[]
): Promise<JudgeResult> {
  const refContext = referenceSnippets.slice(0, 2).join("\n");

  const res = await fetch("/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: "phoneme_unit",
      unitLabel,
      gapDescription,
      refContext,
    }),
  });

  if (!res.ok) {
    return {
      score: 0.4,
      reasoning: "Judge unavailable",
      prescription: gapDescription,
      source: "cached",
    };
  }

  return res.json();
}

export async function scoreReformulation(
  original: string,
  reformulation: string,
  rubric: "clarity" | "concision" | "confidence"
): Promise<{ score: number; reasoning: string; source?: "live" | "cached" }> {
  const res = await fetch("/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "reformulation", original, reformulation, rubric }),
  });

  if (!res.ok) return { score: 0.5, reasoning: "Judge unavailable", source: "cached" };
  return res.json();
}

export async function scoreRhythmTiming(params: {
  pattern: string;
  bpm: number;
  weakBeat: number;
  meanAbsDeviationMs: number;
  refs: string[];
}): Promise<JudgeResult> {
  const res = await fetch("/api/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: "rhythm",
      pattern: params.pattern,
      bpm: params.bpm,
      weakBeat: params.weakBeat,
      meanAbsDeviationMs: params.meanAbsDeviationMs,
      refs: params.refs,
    }),
  });

  if (!res.ok) {
    return {
      score: Math.max(0, Math.min(1, 1 - params.meanAbsDeviationMs / 220)),
      reasoning: "Judge unavailable",
      prescription: `Slow to ${Math.max(60, params.bpm - 10)} BPM and isolate beat ${params.weakBeat + 1}.`,
      source: "cached",
    };
  }

  return res.json();
}
