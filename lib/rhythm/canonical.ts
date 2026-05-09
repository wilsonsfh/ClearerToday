export type CanonicalPattern = {
  pattern: string;
  bpm: number;
  bars: number;
  targetOnsets: number[];
  durationMs: number;
};

export type RhythmComparison = {
  deviations: number[];
  weakBeatIndex: number;
  meanAbsDeviationMs: number;
  score: number;
};

export function buildCanonicalOnsets(
  pattern: string,
  bpm: number,
  bars = 4,
  startMs = 0
): CanonicalPattern {
  const cleaned = pattern.trim().toUpperCase();
  const subdivisionsPerBar = cleaned.length;
  const beatMs = 60_000 / bpm;
  const barDurationMs = beatMs * 4;
  const subdivisionMs = barDurationMs / Math.max(1, subdivisionsPerBar);

  const targetOnsets: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (let idx = 0; idx < subdivisionsPerBar; idx++) {
      const symbol = cleaned[idx];
      if (symbol === "D" || symbol === "U") {
        targetOnsets.push(startMs + bar * barDurationMs + idx * subdivisionMs);
      }
    }
  }

  return {
    pattern: cleaned,
    bpm,
    bars,
    targetOnsets,
    durationMs: Math.round(barDurationMs * bars),
  };
}

export function compareRhythmOnsets(
  userOnsets: number[],
  targetOnsets: number[]
): RhythmComparison {
  if (targetOnsets.length === 0) {
    return {
      deviations: [],
      weakBeatIndex: 0,
      meanAbsDeviationMs: 0,
      score: 0,
    };
  }

  const n = Math.min(userOnsets.length, targetOnsets.length);
  const deviations: number[] = [];

  for (let i = 0; i < n; i++) {
    deviations.push(userOnsets[i] - targetOnsets[i]);
  }

  // Missing beats get penalized as strong deviations.
  for (let i = n; i < targetOnsets.length; i++) {
    deviations.push(220);
  }

  const abs = deviations.map((d) => Math.abs(d));
  const weakBeatIndex = abs.indexOf(Math.max(...abs, 0));
  const meanAbsDeviationMs = abs.reduce((s, d) => s + d, 0) / abs.length;

  // 0ms => 1.0, ~200ms => 0.0
  const score = Math.max(0, Math.min(1, 1 - meanAbsDeviationMs / 200));

  return {
    deviations,
    weakBeatIndex,
    meanAbsDeviationMs,
    score,
  };
}
