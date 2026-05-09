export type GapSignal = {
  kind: "hedge" | "filler" | "jargon" | "phoneme" | "rhythm-beat";
  identifier: string;
  missCount: number;
  hitCount: number;
  lastSeenAt: number;
};

export function rerankRefs<T extends { title?: string; url?: string; snippet?: string }>(
  refs: T[],
  signals: GapSignal[],
  instrument: "articulation" | "phoneme" | "guitar"
): T[] {
  if (signals.length === 0) return refs;

  const scored = refs.map((ref, originalRank) => {
    let adaptScore = 0;
    const refText = `${ref.title ?? ""} ${ref.snippet ?? ""}`.toLowerCase();

    for (const sig of signals) {
      const recency = 1 / (1 + (Date.now() - sig.lastSeenAt) / 3_600_000);
      const weight = sig.missCount / (sig.missCount + sig.hitCount + 1);

      if (refText.includes(sig.identifier.toLowerCase())) {
        adaptScore += weight * recency * 2.0;
      } else if (instrument === "phoneme" && sig.kind === "phoneme") {
        adaptScore += weight * recency * 0.5;
      } else if (instrument === "articulation" && (sig.kind === "hedge" || sig.kind === "filler")) {
        adaptScore += weight * recency * 0.5;
      } else if (instrument === "guitar" && sig.kind === "rhythm-beat") {
        adaptScore += weight * recency * 0.5;
      }
    }

    return { ref, adaptScore, originalRank };
  });

  scored.sort((a, b) =>
    b.adaptScore !== a.adaptScore
      ? b.adaptScore - a.adaptScore
      : a.originalRank - b.originalRank
  );

  return scored.map((s) => s.ref);
}

export function updateGapProfile(
  current: GapSignal[],
  kind: GapSignal["kind"],
  identifier: string,
  judgeScore: number
): GapSignal[] {
  const isMiss = judgeScore < 0.5;
  const now = Date.now();
  const idx = current.findIndex(
    (s) => s.kind === kind && s.identifier === identifier
  );

  if (idx === -1) {
    return [
      ...current,
      {
        kind,
        identifier,
        missCount: isMiss ? 1 : 0,
        hitCount: isMiss ? 0 : 1,
        lastSeenAt: now,
      },
    ];
  }

  const updated = [...current];
  updated[idx] = {
    ...updated[idx],
    missCount: updated[idx].missCount + (isMiss ? 1 : 0),
    hitCount: updated[idx].hitCount + (isMiss ? 0 : 1),
    lastSeenAt: now,
  };
  return updated;
}
