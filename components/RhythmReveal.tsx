"use client";

import { useMemo } from "react";

type RhythmRevealProps = {
  userOnsets: number[];
  targetOnsets: number[];
  bpm: number;
  pattern: string;
  durationMs: number;
  deviations: number[];
  weakBeatIndex: number;
  score: number;
  prescription: string;
  references: Array<{ title: string; url: string; snippet: string }>;
};

export default function RhythmReveal({
  userOnsets,
  targetOnsets,
  bpm,
  pattern,
  durationMs,
  deviations,
  weakBeatIndex,
  score,
  prescription,
  references,
}: RhythmRevealProps) {
  const scoreColor =
    score >= 0.7 ? "text-green-400" : score >= 0.45 ? "text-yellow-400" : "text-red-400";

  const timeline = useMemo(() => {
    return targetOnsets.map((target, i) => {
      const user = userOnsets[i];
      return {
        i,
        target,
        user,
        deviation: deviations[i] ?? 0,
      };
    });
  }, [targetOnsets, userOnsets, deviations]);

  const safeDuration = Math.max(durationMs, 1);

  return (
    <div className="w-full flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className={`text-3xl font-bold ${scoreColor}`}>{Math.round(score * 100)}</span>
        <div>
          <p className={`font-semibold ${scoreColor}`}>Timing Accuracy</p>
          <p className="text-xs text-[#94A3B8]">{pattern} @ {bpm} BPM</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155] overflow-x-auto">
        <p className="text-xs uppercase tracking-wider text-[#94A3B8] mb-3">Onset Timeline</p>
        <div className="relative h-24 min-w-[580px] rounded-lg border border-[#334155] bg-[#0F172A]">
          {timeline.map(({ i, target, user }) => {
            const left = `${(target / safeDuration) * 100}%`;
            const userLeft = typeof user === "number" ? `${(user / safeDuration) * 100}%` : null;
            const isWeak = i === weakBeatIndex;
            return (
              <div key={i}>
                <div
                  className={`absolute top-1 bottom-1 w-[2px] ${isWeak ? "bg-red-500" : "bg-green-500"}`}
                  style={{ left }}
                  title={`Target ${Math.round(target)}ms`}
                />
                {userLeft && (
                  <div
                    className={`absolute top-6 bottom-2 w-[2px] ${isWeak ? "bg-red-300" : "bg-blue-400"}`}
                    style={{ left: userLeft }}
                    title={`User ${Math.round(user)}ms`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[#94A3B8] mt-2">Green = target onsets · Blue = your onsets · Red = largest drift</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {timeline.map(({ i, deviation }) => {
          const abs = Math.abs(deviation);
          const color = i === weakBeatIndex ? "text-red-400" : abs <= 60 ? "text-green-400" : "text-yellow-400";
          return (
            <div key={i} className="rounded-lg border border-[#334155] bg-[#1E293B] p-3 text-sm">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wide mb-1">Beat {i + 1}</p>
              <p className={`${color} font-medium`}>{deviation >= 0 ? "+" : ""}{Math.round(deviation)}ms</p>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
        <p className="text-xs uppercase tracking-wider text-[#94A3B8] mb-1">Drill Prescription</p>
        <p className="text-sm text-[#F8FAFC]">{prescription}</p>
      </div>

      {references.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wider text-[#94A3B8]">Reference Sources (Exa)</p>
          {references.slice(0, 3).map((ref, idx) => (
            <a
              key={idx}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-[#1E293B] border border-[#334155] hover:border-[#22C55E]/50 transition-colors"
            >
              <p className="text-xs font-medium text-[#F8FAFC]">{ref.title}</p>
              {ref.snippet && <p className="text-xs text-[#94A3B8] mt-1">{ref.snippet}</p>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
