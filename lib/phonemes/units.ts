import type { LandmarkSequence } from "@/lib/mediapipe/face";
import type { TimedLandmarkFrame } from "@/lib/phonemes/capture";
import { inferWordPhonemes, normalizePhonemeSymbol } from "@/lib/phonemes/inventory";

export type NormalizedWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type SpokenUnit = {
  label: string;
  startMs: number;
  endMs: number;
  kind: "word" | "idiom" | "phrase";
};

type RawTranscriptWord = {
  word?: string;
  text?: string;
  start_time?: number;
  end_time?: number;
  start?: number;
  end?: number;
};

const KNOWN_IDIOMS = [
  "kind of",
  "sort of",
  "you know",
  "at the end of the day",
  "in the long run",
  "as a matter of fact",
  "on the other hand",
  "in a nutshell",
  "by the way",
];

export function normalizeTranscriptWords(rawWords: RawTranscriptWord[]): NormalizedWord[] {
  if (!Array.isArray(rawWords)) return [];

  const words: NormalizedWord[] = [];

  for (const raw of rawWords) {
    const text = String(raw?.word ?? raw?.text ?? "").trim();
    if (!text || text === " ") continue;

    const startRaw = raw?.start_time ?? raw?.start ?? 0;
    const endRaw = raw?.end_time ?? raw?.end ?? startRaw;

    // ElevenLabs gives seconds. Some providers may already return ms.
    const startMs = startRaw > 100 ? Number(startRaw) : Number(startRaw) * 1000;
    const endMs = endRaw > 100 ? Number(endRaw) : Number(endRaw) * 1000;

    words.push({
      text,
      startMs: Number.isFinite(startMs) ? Math.max(0, startMs) : 0,
      endMs: Number.isFinite(endMs) ? Math.max(0, endMs) : Math.max(0, startMs),
    });
  }

  return words
    .filter((w) => w.text.length > 0)
    .sort((a, b) => a.startMs - b.startMs);
}

export function trimWordsToSpeechWindow(
  words: NormalizedWord[],
  speechStartMs: number,
  speechEndMs: number
): NormalizedWord[] {
  return words.filter((w) => w.endMs >= speechStartMs && w.startMs <= speechEndMs);
}

export function buildSpokenUnits(words: NormalizedWord[]): SpokenUnit[] {
  if (words.length === 0) return [];

  const units: SpokenUnit[] = words.map((w) => ({
    label: w.text,
    startMs: w.startMs,
    endMs: w.endMs,
    kind: "word",
  }));

  const lowerTokens = words.map((w) => sanitize(w.text).toLowerCase());

  for (const idiom of KNOWN_IDIOMS) {
    const idiomTokens = idiom.split(" ");
    for (let i = 0; i <= lowerTokens.length - idiomTokens.length; i++) {
      let matches = true;
      for (let j = 0; j < idiomTokens.length; j++) {
        if (lowerTokens[i + j] !== idiomTokens[j]) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;

      units.push({
        label: idiom,
        startMs: words[i].startMs,
        endMs: words[i + idiomTokens.length - 1].endMs,
        kind: "idiom",
      });
    }
  }

  // Generic short phrase chunks where word gaps are tight.
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].startMs - words[i].endMs;
    if (gap > 350) continue;

    const phraseWords = [words[i].text, words[i + 1].text];
    units.push({
      label: phraseWords.join(" "),
      startMs: words[i].startMs,
      endMs: words[i + 1].endMs,
      kind: "phrase",
    });
  }

  return dedupeUnits(units);
}

export function deriveTargetPhonemes(text: string): string[] {
  const tokens = text
    .split(/\s+/)
    .map((part) => sanitize(part).toLowerCase())
    .filter(Boolean);
  const symbols: string[] = [];

  for (const token of tokens) {
    for (const match of inferWordPhonemes(token)) {
      symbols.push(match.symbol);
    }
  }

  return dedupeSymbols(symbols);
}

export function deriveTargetPhoneme(text: string, preferredPhoneme?: string): string {
  const preferred = preferredPhoneme ? normalizePhonemeSymbol(preferredPhoneme) : "";
  const symbols = deriveTargetPhonemes(text);

  if (preferred && symbols.includes(preferred)) return preferred;
  if (preferred && preferred !== "auto") return preferred;

  return pickMostActionablePhoneme(symbols) ?? "ə";
}

export function sliceFramesByTime(
  timeline: TimedLandmarkFrame[],
  startMs: number,
  endMs: number
): LandmarkSequence {
  return timeline
    .filter((f) => f.tMs >= startMs && f.tMs <= endMs)
    .map((f) => f.frame);
}

function dedupeUnits(units: SpokenUnit[]): SpokenUnit[] {
  const seen = new Set<string>();
  const out: SpokenUnit[] = [];

  for (const u of units) {
    const key = `${u.kind}:${u.label.toLowerCase()}:${Math.round(u.startMs)}-${Math.round(u.endMs)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }

  return out.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

function sanitize(input: string): string {
  return input.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, "");
}

function dedupeSymbols(symbols: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const symbol of symbols) {
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }

  return out;
}

function pickMostActionablePhoneme(symbols: string[]): string | null {
  const priority = [
    "θ",
    "ð",
    "ʃ",
    "ʒ",
    "s",
    "z",
    "r",
    "tʃ",
    "dʒ",
    "l",
    "f",
    "v",
    "w",
    "i",
    "ɪ",
    "e",
    "ɛ",
    "æ",
    "ɑ",
    "ɔ",
    "oʊ",
    "u",
    "aɪ",
    "aʊ",
    "ɔɪ",
    "ɝ",
    "ɚ",
  ];

  return priority.find((symbol) => symbols.includes(symbol)) ?? symbols[0] ?? null;
}
