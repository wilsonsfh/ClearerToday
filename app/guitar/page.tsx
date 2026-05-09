"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import ArticSession from "@/components/ArticSession";
import RhythmReveal from "@/components/RhythmReveal";
import { decodeAudioBlob, detectOnsets, detectSpeechWindow } from "@/lib/audio/onsets";
import { buildCanonicalOnsets, compareRhythmOnsets } from "@/lib/rhythm/canonical";
import { fetchRhythmRefs } from "@/lib/exa/references";
import { rerankRefs } from "@/lib/adaptation/router";
import { scoreRhythmTiming } from "@/lib/openai/judge";
import { speakText } from "@/lib/elevenlabs/tts";
import { api } from "@/convex/_generated/api";

const USER_ID =
  typeof window !== "undefined"
    ? (sessionStorage.getItem("clearertoday_uid") ??
      (() => {
        const id = crypto.randomUUID();
        sessionStorage.setItem("clearertoday_uid", id);
        return id;
      })())
    : "demo";

const TARGET_PATTERN = "DDUU";
const TARGET_BPM = 80;

type RevealState = {
  userOnsets: number[];
  targetOnsets: number[];
  deviations: number[];
  weakBeatIndex: number;
  durationMs: number;
  score: number;
  prescription: string;
  references: Array<{ title: string; url: string; snippet: string }>;
};

export default function GuitarPage() {
  const [statusMsg, setStatusMsg] = useState("");
  const [revealState, setRevealState] = useState<RevealState | null>(null);

  const gapProfile = useQuery(api.gapProfile.get, {
    userId: USER_ID,
    instrument: "guitar",
  });
  const upsertSignal = useMutation(api.gapProfile.upsertSignal);
  const setSessionResult = useMutation(api.sessions.setResult);

  const target = useMemo(() => buildCanonicalOnsets(TARGET_PATTERN, TARGET_BPM, 4, 0), []);

  const runPipeline = async (ctx: Parameters<Parameters<typeof ArticSession>[0]["children"]>[0]) => {
      if (!ctx.sessionId) return;

      try {
        ctx.setMoodLocal("think");
        ctx.setPhase("processing");
        setStatusMsg("Finalizing recording...");

        const blob = await ctx.stopRecording();
        if (!blob) {
          setStatusMsg("No audio captured.");
          ctx.setPhase("idle");
          ctx.setMoodLocal("frown");
          return;
        }

        setStatusMsg("Detecting strum onsets...");
        const audioBuffer = await decodeAudioBlob(blob);
        const speechWindow = detectSpeechWindow(audioBuffer, 0.12, 20);
        const rawOnsets = detectOnsets(audioBuffer, 0.58, { windowMs: 10, minGapMs: 80 });

        const userOnsets = rawOnsets
          .filter((t) => t >= speechWindow.startMs && t <= speechWindow.endMs)
          .map((t) => t - speechWindow.startMs);

        const comparison = compareRhythmOnsets(userOnsets, target.targetOnsets);

        setStatusMsg("Fetching rhythm references...");
        const rawRefs = await fetchRhythmRefs(TARGET_PATTERN, TARGET_BPM);
        const rerankedRefs = rerankRefs(rawRefs, gapProfile?.signals ?? [], "guitar");

        setStatusMsg("Scoring timing...");
        const judge = await scoreRhythmTiming({
          pattern: TARGET_PATTERN,
          bpm: TARGET_BPM,
          weakBeat: comparison.weakBeatIndex,
          meanAbsDeviationMs: comparison.meanAbsDeviationMs,
          refs: rerankedRefs.slice(0, 3).map((r) => r.snippet),
        });

        await upsertSignal({
          userId: USER_ID,
          instrument: "guitar",
          kind: "rhythm-beat",
          identifier: `beat-${comparison.weakBeatIndex + 1}`,
          judgeScore: judge.score,
        });

        await setSessionResult({
          sessionId: ctx.sessionId,
          score: judge.score,
        });

        setRevealState({
          userOnsets,
          targetOnsets: target.targetOnsets,
          deviations: comparison.deviations,
          weakBeatIndex: comparison.weakBeatIndex,
          durationMs: target.durationMs,
          score: judge.score,
          prescription: judge.prescription,
          references: rerankedRefs,
        });

        ctx.setMoodLocal(judge.score >= 0.6 ? "smile" : "drill");
        ctx.setPhase("reveal");

        ctx.setSpeaking(true);
        await speakText(judge.prescription);
        ctx.setSpeaking(false);
      } catch (err) {
        console.error("[guitar pipeline]", err);
        setStatusMsg("Rhythm analysis failed. Check setup and try again.");
        ctx.setPhase("idle");
        ctx.setMoodLocal("frown");
      }
    };

  return (
    <ArticSession mode="guitar" userId={USER_ID}>
      {(ctx) => (
        <div className="flex flex-col items-center gap-6 w-full animate-fade-in">
          <h1 className="text-2xl font-bold tracking-tight">Rhythm Coach</h1>
          <p className="text-[#94A3B8] text-sm max-w-sm text-center">
            Strum DDUU at 80 BPM. We trim silence, detect onset drift, and prescribe the next drill.
          </p>

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1E293B] border border-[#334155] text-sm font-mono">
            <span className="text-[#22C55E]">{TARGET_PATTERN.split("").join(" ")}</span>
            <span className="text-[#94A3B8]">•</span>
            <span className="text-[#94A3B8]">{TARGET_BPM} BPM</span>
          </div>

          <div className="flex gap-4">
            {ctx.phase === "idle" && (
              <button
                onClick={ctx.startRecording}
                className="px-6 py-3 rounded-xl bg-[#22C55E] text-[#0F172A] font-semibold hover:bg-[#16A34A] transition-colors duration-200 cursor-pointer"
              >
                Start
              </button>
            )}
            {ctx.phase === "recording" && (
              <button
                onClick={() => runPipeline(ctx)}
                className="px-6 py-3 rounded-xl bg-[#EF4444] text-white font-semibold cursor-pointer animate-pulse-green"
              >
                Stop + Diagnose
              </button>
            )}
          </div>

          {(ctx.phase === "processing" || (ctx.phase === "recording" && statusMsg)) && (
            <p className="text-[#94A3B8] text-sm animate-pulse-green">{statusMsg}</p>
          )}

          {ctx.phase === "reveal" && revealState && (
            <>
              <RhythmReveal
                userOnsets={revealState.userOnsets}
                targetOnsets={revealState.targetOnsets}
                bpm={TARGET_BPM}
                pattern={TARGET_PATTERN}
                durationMs={revealState.durationMs}
                deviations={revealState.deviations}
                weakBeatIndex={revealState.weakBeatIndex}
                score={revealState.score}
                prescription={revealState.prescription}
                references={revealState.references}
              />
              <button
                onClick={() => {
                  setRevealState(null);
                  setStatusMsg("");
                  ctx.setPhase("idle");
                  ctx.setMoodLocal("idle");
                }}
                className="mt-2 px-5 py-2 rounded-xl bg-[#1E293B] border border-[#334155] text-sm hover:border-[#22C55E] transition-colors cursor-pointer"
              >
                Try again
              </button>
            </>
          )}

          {gapProfile && gapProfile.signals.length > 0 && (
            <div className="w-full p-4 rounded-xl bg-[#1E293B] border border-[#334155] mt-2">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-2">Your gap profile · rhythm</p>
              <div className="flex flex-col gap-1">
                {[...gapProfile.signals]
                  .sort((a, b) => b.missCount - a.missCount)
                  .map((s) => (
                    <div key={s.identifier} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-[#22C55E]">{s.identifier}</span>
                      <span className="text-red-400">{s.missCount}✗</span>
                      <span className="text-green-400">{s.hitCount}✓</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ArticSession>
  );
}
