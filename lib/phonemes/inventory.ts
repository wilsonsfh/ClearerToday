export type PhonemeKind =
  | "stop"
  | "fricative"
  | "affricate"
  | "nasal"
  | "approximant"
  | "vowel"
  | "diphthong";

export type PhonemeProfile = {
  symbol: string;
  aliases: string[];
  label: string;
  example: string;
  cue: string;
  kind: PhonemeKind;
};

export type PhonemeMatch = {
  symbol: string;
  sourceText: string;
  confidence: number;
  reason: string;
};

export type WordPhonemePlan = {
  word: string;
  phonemes: PhonemeMatch[];
};

export const PHONEME_INVENTORY: PhonemeProfile[] = [
  { symbol: "p", aliases: ["P"], label: "P", example: "pin", kind: "stop", cue: "Close both lips, build a small puff of air, then release." },
  { symbol: "b", aliases: ["B"], label: "B", example: "bin", kind: "stop", cue: "Close both lips and release with voice." },
  { symbol: "t", aliases: ["T"], label: "T", example: "top", kind: "stop", cue: "Touch the tongue tip near the ridge behind your teeth, then release." },
  { symbol: "d", aliases: ["D"], label: "D", example: "dog", kind: "stop", cue: "Touch the tongue tip near the ridge behind your teeth and release with voice." },
  { symbol: "k", aliases: ["K"], label: "K", example: "cat", kind: "stop", cue: "Lift the back of the tongue, stop the air, then release." },
  { symbol: "g", aliases: ["G"], label: "G", example: "go", kind: "stop", cue: "Lift the back of the tongue and release with voice." },
  { symbol: "m", aliases: ["M"], label: "M", example: "moon", kind: "nasal", cue: "Close both lips and hum through the nose." },
  { symbol: "n", aliases: ["N"], label: "N", example: "no", kind: "nasal", cue: "Touch the tongue tip near the ridge behind your teeth and send sound through the nose." },
  { symbol: "ŋ", aliases: ["NG", "ng"], label: "NG", example: "sing", kind: "nasal", cue: "Lift the back of the tongue like /k/, but let sound flow through the nose." },
  { symbol: "f", aliases: ["F", "ph"], label: "F", example: "fan", kind: "fricative", cue: "Rest top teeth on the lower lip and push air through." },
  { symbol: "v", aliases: ["V"], label: "V", example: "van", kind: "fricative", cue: "Rest top teeth on the lower lip and add voice." },
  { symbol: "θ", aliases: ["TH", "th", "theta"], label: "unvoiced TH", example: "think", kind: "fricative", cue: "Place the tongue lightly between the teeth and let air pass through." },
  { symbol: "ð", aliases: ["DH", "dh", "voiced th"], label: "voiced TH", example: "this", kind: "fricative", cue: "Place the tongue lightly between the teeth and add voice." },
  { symbol: "s", aliases: ["S", "ce", "ci"], label: "S", example: "see", kind: "fricative", cue: "Keep teeth close, lips slightly spread, and send a narrow stream of air forward." },
  { symbol: "z", aliases: ["Z"], label: "Z", example: "zoo", kind: "fricative", cue: "Use the /s/ shape, but add voice." },
  { symbol: "ʃ", aliases: ["SH", "sh"], label: "SH", example: "ship", kind: "fricative", cue: "Round the lips slightly and send air over the middle of the tongue." },
  { symbol: "ʒ", aliases: ["ZH", "zh"], label: "ZH", example: "measure", kind: "fricative", cue: "Use the /sh/ shape, but add voice." },
  { symbol: "h", aliases: ["H"], label: "H", example: "hat", kind: "fricative", cue: "Open the mouth and release a light breath." },
  { symbol: "tʃ", aliases: ["CH", "ch", "tch"], label: "CH", example: "chair", kind: "affricate", cue: "Start like /t/, then release into /sh/." },
  { symbol: "dʒ", aliases: ["JH", "jh", "j", "dge"], label: "J", example: "judge", kind: "affricate", cue: "Start like /d/, then release into voiced /zh/." },
  { symbol: "l", aliases: ["L"], label: "L", example: "light", kind: "approximant", cue: "Touch the tongue tip near the ridge behind your teeth and let sound pass around the sides." },
  { symbol: "r", aliases: ["R", "er"], label: "R", example: "run", kind: "approximant", cue: "Pull the tongue back or bunch it high; keep the lips slightly rounded." },
  { symbol: "w", aliases: ["W", "wh"], label: "W", example: "we", kind: "approximant", cue: "Round the lips, then glide into the vowel." },
  { symbol: "j", aliases: ["Y", "y"], label: "Y", example: "yes", kind: "approximant", cue: "Raise the front of the tongue toward the roof of the mouth, then glide into the vowel." },
  { symbol: "i", aliases: ["IY", "ee", "ea"], label: "long EE", example: "see", kind: "vowel", cue: "Smile slightly and keep the tongue high and forward." },
  { symbol: "ɪ", aliases: ["IH"], label: "short I", example: "sit", kind: "vowel", cue: "Keep the mouth relaxed with the tongue high but not tense." },
  { symbol: "e", aliases: ["EY", "ay"], label: "long A", example: "say", kind: "vowel", cue: "Start mid-front and glide slightly higher." },
  { symbol: "ɛ", aliases: ["EH"], label: "short E", example: "set", kind: "vowel", cue: "Open the mouth a little and keep the tongue forward." },
  { symbol: "æ", aliases: ["AE"], label: "short A", example: "cat", kind: "vowel", cue: "Open the mouth wider with the tongue low and forward." },
  { symbol: "ə", aliases: ["AH0", "schwa"], label: "schwa", example: "about", kind: "vowel", cue: "Relax the mouth and say a short, unstressed neutral vowel." },
  { symbol: "ʌ", aliases: ["AH"], label: "short U", example: "cup", kind: "vowel", cue: "Keep the mouth relaxed and slightly open." },
  { symbol: "ɑ", aliases: ["AA"], label: "AH", example: "father", kind: "vowel", cue: "Open the jaw and keep the tongue low and back." },
  { symbol: "ɔ", aliases: ["AO"], label: "AW", example: "thought", kind: "vowel", cue: "Open the mouth with slight lip rounding." },
  { symbol: "oʊ", aliases: ["OW", "oh"], label: "long O", example: "go", kind: "diphthong", cue: "Start rounded and glide toward /w/." },
  { symbol: "ʊ", aliases: ["UH"], label: "short OO", example: "book", kind: "vowel", cue: "Round the lips lightly with a relaxed high-back tongue." },
  { symbol: "u", aliases: ["UW", "oo"], label: "long OO", example: "blue", kind: "vowel", cue: "Round the lips more and keep the tongue high and back." },
  { symbol: "aɪ", aliases: ["AY", "igh"], label: "long I", example: "my", kind: "diphthong", cue: "Start open, then glide upward toward /i/." },
  { symbol: "aʊ", aliases: ["AW", "ou", "ow"], label: "OW", example: "now", kind: "diphthong", cue: "Start open, then round into /w/." },
  { symbol: "ɔɪ", aliases: ["OY", "oi", "oy"], label: "OY", example: "boy", kind: "diphthong", cue: "Start rounded, then glide toward /i/." },
  { symbol: "ɝ", aliases: ["ER", "ir", "ur"], label: "stressed ER", example: "bird", kind: "vowel", cue: "Hold a strong /r/-colored vowel with the tongue pulled back or bunched." },
  { symbol: "ɚ", aliases: ["ER0"], label: "unstressed ER", example: "teacher", kind: "vowel", cue: "Use a lighter, shorter /r/-colored vowel." },
];

const PROFILE_BY_SYMBOL = new Map(PHONEME_INVENTORY.map((p) => [p.symbol, p]));
const PROFILE_BY_ALIAS = new Map<string, PhonemeProfile>();

for (const profile of PHONEME_INVENTORY) {
  PROFILE_BY_ALIAS.set(profile.symbol.toLowerCase(), profile);
  for (const alias of profile.aliases) {
    PROFILE_BY_ALIAS.set(alias.toLowerCase(), profile);
  }
}

const WORD_EXCEPTIONS: Record<string, string[]> = {
  a: ["ə"],
  the: ["ð", "ə"],
  this: ["ð", "ɪ", "s"],
  that: ["ð", "æ", "t"],
  these: ["ð", "i", "z"],
  those: ["ð", "oʊ", "z"],
  they: ["ð", "e"],
  them: ["ð", "ɛ", "m"],
  their: ["ð", "ɛ", "r"],
  there: ["ð", "ɛ", "r"],
  then: ["ð", "ɛ", "n"],
  than: ["ð", "æ", "n"],
  through: ["θ", "r", "u"],
  though: ["ð", "oʊ"],
  thought: ["θ", "ɔ", "t"],
  think: ["θ", "ɪ", "ŋ", "k"],
  three: ["θ", "r", "i"],
  she: ["ʃ", "i"],
  sells: ["s", "ɛ", "l", "z"],
  sea: ["s", "i"],
  seashells: ["s", "i", "ʃ", "ɛ", "l", "z"],
  seashore: ["s", "i", "ʃ", "ɔ", "r"],
  seashores: ["s", "i", "ʃ", "ɔ", "r", "z"],
  shore: ["ʃ", "ɔ", "r"],
  shores: ["ʃ", "ɔ", "r", "z"],
  by: ["b", "aɪ"],
  rhyme: ["r", "aɪ", "m"],
  rhymes: ["r", "aɪ", "m", "z"],
};

const VOICED_TH_WORDS = new Set([
  "the",
  "this",
  "that",
  "these",
  "those",
  "they",
  "them",
  "their",
  "there",
  "then",
  "than",
  "though",
  "thus",
  "therefore",
  "another",
  "mother",
  "father",
  "brother",
  "weather",
  "whether",
]);

type GraphemeRule = {
  pattern: RegExp;
  phonemes: string[] | ((word: string, match: string, index: number) => string[]);
  reason: string;
};

const GRAPHEME_RULES: GraphemeRule[] = [
  { pattern: /^(tion|sion|cian)/, phonemes: ["ʃ", "ə", "n"], reason: "common -tion/-sion ending" },
  { pattern: /^(sure)/, phonemes: ["ʒ", "ɚ"], reason: "common -sure ending" },
  { pattern: /^(ture)/, phonemes: ["tʃ", "ɚ"], reason: "common -ture ending" },
  { pattern: /^(dge)/, phonemes: ["dʒ"], reason: "dge maps to /dʒ/" },
  { pattern: /^(tch|ch)/, phonemes: ["tʃ"], reason: "ch/tch maps to /tʃ/" },
  { pattern: /^(sh)/, phonemes: ["ʃ"], reason: "sh maps to /ʃ/" },
  { pattern: /^(zh)/, phonemes: ["ʒ"], reason: "zh maps to /ʒ/" },
  { pattern: /^(th)/, phonemes: (word) => [VOICED_TH_WORDS.has(word) ? "ð" : "θ"], reason: "th maps to voiced or unvoiced TH by word context" },
  { pattern: /^(ng)/, phonemes: ["ŋ"], reason: "ng maps to /ŋ/" },
  { pattern: /^(ph)/, phonemes: ["f"], reason: "ph maps to /f/" },
  { pattern: /^(qu)/, phonemes: ["k", "w"], reason: "qu commonly maps to /kw/" },
  { pattern: /^(wr)/, phonemes: ["r"], reason: "wr commonly maps to /r/" },
  { pattern: /^(kn)/, phonemes: ["n"], reason: "kn commonly maps to /n/" },
  { pattern: /^(wh)/, phonemes: ["w"], reason: "wh commonly maps to /w/" },
  { pattern: /^(ck)/, phonemes: ["k"], reason: "ck maps to /k/" },
  { pattern: /^(ee|ea|ie)/, phonemes: ["i"], reason: "common long-ee spelling" },
  { pattern: /^(igh)/, phonemes: ["aɪ"], reason: "igh maps to long-I" },
  { pattern: /^(ai|ay)/, phonemes: ["e"], reason: "ai/ay maps to long-A" },
  { pattern: /^(oa|oe)/, phonemes: ["oʊ"], reason: "oa/oe maps to long-O" },
  { pattern: /^(oo)/, phonemes: ["u"], reason: "oo often maps to long-OO" },
  { pattern: /^(oi|oy)/, phonemes: ["ɔɪ"], reason: "oi/oy maps to /ɔɪ/" },
  { pattern: /^(ou|ow)/, phonemes: ["aʊ"], reason: "ou/ow often maps to /aʊ/" },
  { pattern: /^(ar)/, phonemes: ["ɑ", "r"], reason: "ar maps to an open vowel plus /r/" },
  { pattern: /^(er|ir|ur)/, phonemes: ["ɝ"], reason: "er/ir/ur maps to r-colored vowel" },
  { pattern: /^(or)/, phonemes: ["ɔ", "r"], reason: "or maps to rounded vowel plus /r/" },
];

export function getPhonemeProfile(symbol: string): PhonemeProfile {
  const normalized = normalizePhonemeSymbol(symbol);
  return PROFILE_BY_SYMBOL.get(normalized) ?? {
    symbol: normalized,
    aliases: [],
    label: normalized.toUpperCase(),
    example: "custom word",
    kind: "vowel",
    cue: "Listen back, compare with a reference, and repeat slowly.",
  };
}

export function normalizePhonemeSymbol(input: string): string {
  const cleaned = input.trim();
  if (!cleaned) return "ə";
  return PROFILE_BY_ALIAS.get(cleaned.toLowerCase())?.symbol ?? cleaned;
}

export function describePhoneme(symbol: string): string {
  const profile = getPhonemeProfile(symbol);
  return `/${profile.symbol}/ (${profile.label} as in "${profile.example}")`;
}

export function phonemeCue(symbol: string): string {
  return getPhonemeProfile(symbol).cue;
}

export function summarizeGapSignal(symbol: string, missCount: number, hitCount: number): string {
  const profile = getPhonemeProfile(symbol);
  const attempts = missCount + hitCount;
  const label = `/${profile.symbol}/, ${profile.label} as in "${profile.example}"`;

  if (attempts === 0) {
    return `${label}: no scored attempts yet.`;
  }
  if (missCount === 0) {
    return `${label}: clear so far across ${attempts} ${pluralize("attempt", attempts)}. ${attempts < 3 ? "Keep practicing so we can confirm consistency." : "Keep it in rotation."}`;
  }
  if (hitCount === 0) {
    return `${label}: needs attention. You missed ${missCount} ${pluralize("time", missCount)}. ${profile.cue}`;
  }
  return `${label}: mixed. You missed ${missCount} and landed ${hitCount}. ${profile.cue}`;
}

export function inferPracticePlan(text: string): WordPhonemePlan[] {
  return tokenizeWords(text).map((word) => ({
    word,
    phonemes: inferWordPhonemes(word),
  }));
}

export function inferPhonemeSymbols(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const plan of inferPracticePlan(text)) {
    for (const match of plan.phonemes) {
      if (seen.has(match.symbol)) continue;
      seen.add(match.symbol);
      out.push(match.symbol);
    }
  }

  return out;
}

export function inferWordPhonemes(rawWord: string): PhonemeMatch[] {
  const word = cleanWord(rawWord);
  if (!word) return [];

  const exception = WORD_EXCEPTIONS[word];
  if (exception) {
    return exception.map((symbol) => ({
      symbol,
      sourceText: rawWord,
      confidence: 0.95,
      reason: "common-word pronunciation exception",
    }));
  }

  const matches: PhonemeMatch[] = [];
  let index = 0;

  while (index < word.length) {
    const rest = word.slice(index);
    const matchedRule = GRAPHEME_RULES.find((rule) => rule.pattern.test(rest));

    if (matchedRule) {
      const matchedText = rest.match(matchedRule.pattern)?.[0] ?? rest[0];
      const phonemes =
        typeof matchedRule.phonemes === "function"
          ? matchedRule.phonemes(word, matchedText, index)
          : matchedRule.phonemes;
      for (const symbol of phonemes) {
        matches.push({
          symbol,
          sourceText: matchedText,
          confidence: 0.8,
          reason: matchedRule.reason,
        });
      }
      index += matchedText.length;
      continue;
    }

    const char = word[index];
    for (const symbol of inferSingleLetterPhonemes(word, char, index)) {
      matches.push({
        symbol,
        sourceText: char,
        confidence: 0.55,
        reason: "fallback single-letter inference",
      });
    }
    index += 1;
  }

  return collapseSilentLetters(matches);
}

export function formatPhonemeList(symbols: string[]): string {
  if (symbols.length === 0) return "no clear phoneme target";
  return symbols.map((symbol) => `/${symbol}/`).join(" ");
}

export function tokenizeWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((part) => cleanWord(part))
    .filter(Boolean);
}

function inferSingleLetterPhonemes(word: string, char: string, index: number): string[] {
  const next = word[index + 1] ?? "";
  const prev = word[index - 1] ?? "";
  const isFinal = index === word.length - 1;

  switch (char) {
    case "a":
      return isFinal ? ["ə"] : ["æ"];
    case "e":
      return isFinal ? [] : ["ɛ"];
    case "i":
      return ["ɪ"];
    case "o":
      return ["ɑ"];
    case "u":
      return ["ʌ"];
    case "y":
      return isFinal ? ["i"] : ["j"];
    case "c":
      return /[eiy]/.test(next) ? ["s"] : ["k"];
    case "g":
      return /[eiy]/.test(next) ? ["dʒ"] : ["g"];
    case "x":
      return ["k", "s"];
    case "q":
      return ["k"];
    case "s":
      return isFinal && /[aeiouylrnmbdg]/.test(prev) ? ["z"] : ["s"];
    case "r":
      return ["r"];
    case "j":
      return ["dʒ"];
    default:
      return PROFILE_BY_SYMBOL.has(char) ? [char] : [];
  }
}

function collapseSilentLetters(matches: PhonemeMatch[]): PhonemeMatch[] {
  return matches.filter((match) => match.symbol.length > 0);
}

function cleanWord(word: string): string {
  return word.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}
