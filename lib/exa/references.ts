import { Exa } from "exa-js";

let exaClient: Exa | null = null;

type ExaResultLike = {
  title?: string | null;
  url: string;
  highlights?: string[];
  text?: string;
};

function getExaClient(): Exa | null {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;
  if (!exaClient) exaClient = new Exa(apiKey);
  return exaClient;
}

export type PhonemeRef = {
  title: string;
  url: string;
  snippet: string;
};

export type ArticRef = {
  title: string;
  url: string;
  rubricPoints: string[];
};

export type RhythmRef = {
  title: string;
  url: string;
  snippet: string;
};

export async function fetchPhonemeRefs(phoneme: string): Promise<PhonemeRef[]> {
  const exa = getExaClient();
  if (!exa) return FALLBACK_PHONEME_REFS[phoneme] ?? [];
  try {
    const result = await exa.searchAndContents(
      `how to pronounce ${phoneme} phoneme speech therapy tutorial articulation`,
      {
        numResults: 5,
        type: "neural",
        highlights: { numSentences: 2, highlightsPerUrl: 1 },
      }
    );
    return result.results.map((r) => {
      const row = r as ExaResultLike;
      return {
        title: row.title ?? row.url,
        url: row.url,
        snippet: row.highlights?.[0] ?? row.text?.slice(0, 200) ?? "",
      };
    });
  } catch {
    return FALLBACK_PHONEME_REFS[phoneme] ?? [];
  }
}

export async function fetchMouthShapeRefsForUtterance(
  utterance: string,
  phonemeHint?: string
): Promise<PhonemeRef[]> {
  const exa = getExaClient();
  const cleaned = utterance.trim();
  const hint = phonemeHint?.trim();

  if (!exa) {
    return hint ? FALLBACK_PHONEME_REFS[hint] ?? [] : [];
  }

  const query = cleaned
    ? `mouth shape pronunciation of "${cleaned}" ${hint ? `phoneme ${hint}` : ""} speech therapy articulation`
    : `speech therapy mouth shape pronunciation ${hint ?? ""}`;

  try {
    const result = await exa.searchAndContents(query, {
      numResults: 5,
      type: "neural",
      highlights: { numSentences: 2, highlightsPerUrl: 1 },
    });

    const refs = result.results.map((r) => {
      const row = r as ExaResultLike;
      return {
        title: row.title ?? row.url,
        url: row.url,
        snippet: row.highlights?.[0] ?? row.text?.slice(0, 200) ?? "",
      };
    });

    if (refs.length > 0) return refs;
  } catch {
    // fall through to phoneme fallback
  }

  if (hint) {
    return FALLBACK_PHONEME_REFS[hint] ?? [];
  }

  return [];
}

export async function fetchArticulationRefs(
  mode: "pitch" | "concept" | "present"
): Promise<ArticRef[]> {
  const exa = getExaClient();
  if (!exa) return [];
  const queries = {
    pitch: "investor pitch delivery tips concise confident clear",
    concept: "explain complex concept clearly simply without jargon",
    present: "presentation speaking clearly pacing confidence tips",
  };
  try {
    const result = await exa.searchAndContents(queries[mode], {
      numResults: 5,
      type: "neural",
      highlights: { numSentences: 3, highlightsPerUrl: 2 },
    });
    return result.results.map((r) => {
      const row = r as ExaResultLike;
      return {
        title: row.title ?? row.url,
        url: row.url,
        rubricPoints: row.highlights?.slice(0, 3) ?? [row.text?.slice(0, 200) ?? ""],
      };
    });
  } catch {
    return [];
  }
}

export async function fetchRhythmRefs(
  pattern: string,
  bpm: number
): Promise<RhythmRef[]> {
  const exa = getExaClient();
  if (!exa) return [];
  try {
    const result = await exa.searchAndContents(
      `guitar strumming pattern ${pattern} ${bpm} bpm tutorial beginner`,
      {
        numResults: 5,
        type: "neural",
        highlights: { numSentences: 2, highlightsPerUrl: 1 },
      }
    );
    return result.results.map((r) => {
      const row = r as ExaResultLike;
      return {
        title: row.title ?? row.url,
        url: row.url,
        snippet: row.highlights?.[0] ?? row.text?.slice(0, 200) ?? "",
      };
    });
  } catch {
    return [];
  }
}

// Fallback if Exa is down or returns < 3 results
const FALLBACK_PHONEME_REFS: Record<string, PhonemeRef[]> = {
  θ: [
    {
      title: "How to Pronounce TH (θ) — Speech Therapy",
      url: "https://www.speechtherapy.com/th-sound",
      snippet:
        "Place the tip of your tongue lightly against the back of your upper front teeth. Allow air to flow over your tongue while keeping it in contact with your teeth.",
    },
  ],
  r: [
    {
      title: "Bunched R vs Retroflex R — Speech Therapy",
      url: "https://www.speechtherapy.com/r-sound",
      snippet:
        "For the retroflex /r/, curl the tongue tip up toward the roof of your mouth. For the bunched /r/, bunch the tongue body toward the back of the mouth.",
    },
  ],
};
