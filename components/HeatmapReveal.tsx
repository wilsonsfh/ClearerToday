"use client";

import { useMemo } from "react";

export type HeatSegment = {
  phrase: string;
  impact: number;
  kind: "hedge" | "filler" | "load-bearing" | "jargon" | "neutral";
};

export type AblationRowLike = {
  _id: string;
  inputPhrase: string;
  status: "pending" | "running" | "done" | "error";
  outputText?: string;
  score?: number;
  referenceLabel?: string;
};

type HeatmapRevealProps = {
  transcript: string;
  segments: HeatSegment[];
  ablationRows: AblationRowLike[];
  onPhraseClick: (phrase: string) => void;
};

export default function HeatmapReveal({
  transcript,
  segments,
  ablationRows,
  onPhraseClick,
}: HeatmapRevealProps) {
  const byPhrase = useMemo(() => {
    const map = new Map<string, HeatSegment>();
    for (const segment of segments) {
      map.set(segment.phrase.toLowerCase(), segment);
    }
    return map;
  }, [segments]);

  const transcriptTokens = useMemo(() => {
    return transcript.split(/(\s+)/);
  }, [transcript]);

  const sortedAblations = useMemo(
    () => [...ablationRows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [ablationRows]
  );

  return (
    <div className="w-full flex flex-col gap-5 animate-fade-in">
      <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
        <p className="text-xs uppercase tracking-wider text-[#94A3B8] mb-3">Transcript Heatmap</p>
        <p className="text-sm leading-7 text-[#E2E8F0]">
          {transcriptTokens.map((token, idx) => {
            const cleaned = token.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "");
            const seg = cleaned ? byPhrase.get(cleaned) : undefined;
            if (!seg) {
              return <span key={idx}>{token}</span>;
            }

            const impact = Math.max(0, Math.min(1, seg.impact));
            const hue = Math.round((1 - impact) * 120); // green -> red
            const bg = `hsla(${hue}, 85%, 52%, 0.22)`;
            const border = `hsla(${hue}, 85%, 52%, 0.6)`;

            return (
              <button
                key={idx}
                className="mx-[1px] px-1 py-0.5 rounded border cursor-pointer transition-colors"
                style={{ backgroundColor: bg, borderColor: border }}
                onClick={() => onPhraseClick(seg.phrase)}
                title={`${seg.kind} · impact ${(impact * 100).toFixed(0)}%`}
              >
                {token}
              </button>
            );
          })}
        </p>
      </div>

      <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
        <p className="text-xs uppercase tracking-wider text-[#94A3B8] mb-3">Counterfactual Ablations</p>
        <div className="flex flex-col gap-2">
          {sortedAblations.length === 0 && (
            <p className="text-sm text-[#94A3B8]">No ablations yet. Click a highlighted phrase to run one.</p>
          )}

          {sortedAblations.map((row) => {
            const score = row.score ?? 0;
            const scoreColor =
              score >= 0.7 ? "text-green-400" : score >= 0.45 ? "text-yellow-400" : "text-red-400";

            return (
              <div
                key={row._id}
                className="rounded-lg border border-[#334155] bg-[#0F172A] p-3 text-sm flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#E2E8F0] font-medium">&ldquo;{row.inputPhrase}&rdquo;</span>
                  <span className="text-xs text-[#94A3B8] uppercase tracking-wide">{row.status}</span>
                </div>

                {row.status === "running" || row.status === "pending" ? (
                  <p className="text-xs text-[#94A3B8] animate-pulse-green">Generating counterfactual...</p>
                ) : row.status === "error" ? (
                  <p className="text-xs text-red-400">Counterfactual failed. Retry by clicking phrase again.</p>
                ) : (
                  <>
                    <p className={`text-xs ${scoreColor}`}>Improvement score: {(score * 100).toFixed(0)}%</p>
                    {row.outputText && <p className="text-xs text-[#CBD5E1]">{row.outputText}</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
