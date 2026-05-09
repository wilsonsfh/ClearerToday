export type ArticulationMode = "pitch" | "concept" | "present";

export type PhraseKind = "hedge" | "filler" | "load-bearing" | "jargon" | "neutral";

export type PhraseSegment = {
  phrase: string;
  kind: PhraseKind;
  impact: number;
};

export type CounterfactualResult = {
  output: string;
  score: number;
  reasoning: string;
  source: "live" | "cached";
};

export async function identifyPhrases(
  transcript: string,
  mode: ArticulationMode
): Promise<Array<PhraseSegment>> {
  const res = await fetch("/api/ablate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "identify", transcript, mode }),
  });

  if (!res.ok) {
    return localIdentifyFallback(transcript);
  }

  const data = await res.json();
  if (!Array.isArray(data.segments)) {
    return localIdentifyFallback(transcript);
  }

  return data.segments as PhraseSegment[];
}

export async function generateCounterfactual(
  transcript: string,
  phraseToRemove: string,
  mode: ArticulationMode
): Promise<CounterfactualResult> {
  const res = await fetch("/api/ablate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task: "counterfactual",
      transcript,
      phraseToRemove,
      mode,
    }),
  });

  if (!res.ok) {
    const output = removePhraseLocally(transcript, phraseToRemove);
    return {
      output,
      score: 0.55,
      reasoning: "Fallback rewrite without model scoring.",
      source: "cached",
    };
  }

  const data = await res.json();
  return {
    output: typeof data.output === "string" ? data.output : removePhraseLocally(transcript, phraseToRemove),
    score: typeof data.score === "number" ? data.score : 0.55,
    reasoning: typeof data.reasoning === "string" ? data.reasoning : "Fallback reasoning",
    source: data.source === "live" ? "live" : "cached",
  };
}

function localIdentifyFallback(transcript: string): PhraseSegment[] {
  const words = tokenize(transcript);
  if (words.length === 0) return [];

  const fillerSet = new Set(["um", "uh", "like", "you know", "actually", "basically"]);
  const hedgeSet = new Set(["maybe", "probably", "sort of", "kind of", "i think", "i guess"]);

  const segments: PhraseSegment[] = [];

  for (const word of words) {
    const lower = word.toLowerCase();
    if (fillerSet.has(lower)) {
      segments.push({ phrase: word, kind: "filler", impact: 0.82 });
      continue;
    }
    if (hedgeSet.has(lower)) {
      segments.push({ phrase: word, kind: "hedge", impact: 0.74 });
      continue;
    }
    if (lower.length >= 10) {
      segments.push({ phrase: word, kind: "jargon", impact: 0.56 });
      continue;
    }
  }

  if (segments.length === 0) {
    return words.slice(0, Math.min(6, words.length)).map((w) => ({
      phrase: w,
      kind: "neutral" as const,
      impact: 0.2,
    }));
  }

  return segments.slice(0, 8);
}

function removePhraseLocally(transcript: string, phrase: string): string {
  if (!phrase.trim()) return transcript;
  const escaped = escapeRegExp(phrase.trim());
  const without = transcript.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  return without.replace(/\s+/g, " ").trim() || transcript;
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim().replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, ""))
    .filter(Boolean);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
