"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import ArticSession, { type ArticSessionContext } from "@/components/ArticSession";
import HeatmapReveal, { type HeatSegment } from "@/components/HeatmapReveal";
import { transcribeAudio } from "@/lib/elevenlabs/scribe";
import { speakText } from "@/lib/elevenlabs/tts";
import { identifyPhrases } from "@/lib/openai/ablator";
import { prewarmSandboxes, runAblationSandbox } from "@/lib/daytona/sandbox";
import { api } from "@/convex/_generated/api";

export type ArticulationMode = "pitch" | "concept" | "present";

type ArticulationModePageProps = {
  mode: ArticulationMode;
  userId: string;
  title: string;
  description: string;
  ctaLabel: string;
};

export default function ArticulationModePage({
  mode,
  userId,
  title,
  description,
  ctaLabel,
}: ArticulationModePageProps) {
  return (
    <ArticSession mode={mode} userId={userId}>
      {(ctx) => <ArticulationBody ctx={ctx} mode={mode} userId={userId} title={title} description={description} ctaLabel={ctaLabel} />}
    </ArticSession>
  );
}

type ArticulationBodyProps = {
  ctx: ArticSessionContext;
  mode: ArticulationMode;
  userId: string;
  title: string;
  description: string;
  ctaLabel: string;
};

function ArticulationBody({ ctx, mode, userId, title, description, ctaLabel }: ArticulationBodyProps) {
  const [statusMsg, setStatusMsg] = useState("");
  const [transcript, setTranscript] = useState("");
  const [segments, setSegments] = useState<HeatSegment[]>([]);
  const [referenceSources, setReferenceSources] = useState<
    Array<{ title: string; url: string; rubricPoints: string[] }>
  >([]);

  const ablations =
    useQuery(api.ablations.bySession, ctx.sessionId ? { sessionId: ctx.sessionId } : "skip") ?? [];

  const gapProfile = useQuery(api.gapProfile.get, {
    userId,
    instrument: "articulation",
  });

  const createAblation = useMutation(api.ablations.create);
  const setAblationRunning = useMutation(api.ablations.setRunning);
  const setAblationDone = useMutation(api.ablations.setDone);
  const setAblationError = useMutation(api.ablations.setError);
  const setSessionResult = useMutation(api.sessions.setResult);
  const upsertSignal = useMutation(api.gapProfile.upsertSignal);

  const actionableSegments = useMemo(() => {
    return [...segments]
      .filter((s) => s.kind === "hedge" || s.kind === "filler" || s.kind === "jargon")
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 4);
  }, [segments]);

  const runSingleAblation = useCallback(
    async (
      phrase: string,
      kind: HeatSegment["kind"],
      transcriptInput = transcript
    ) => {
      if (!ctx.sessionId || !transcriptInput.trim()) return null;

      const ablationId = await createAblation({
        sessionId: ctx.sessionId,
        inputPhrase: phrase,
        referenceLabel: kind,
      });

      try {
        await setAblationRunning({
          ablationId,
          sandboxId: crypto.randomUUID(),
        });

        const result = await runAblationSandbox({
          transcript: transcriptInput,
          phraseToRemove: phrase,
          mode,
        });

        await setAblationDone({
          ablationId,
          outputText: result.output,
          score: result.score,
        });

        if (kind === "hedge" || kind === "filler" || kind === "jargon") {
          await upsertSignal({
            userId,
            instrument: "articulation",
            kind,
            identifier: phrase.toLowerCase(),
            judgeScore: result.score,
          });
        }

        return result;
      } catch (err) {
        console.error("[ablation]", err);
        await setAblationError({ ablationId });
        return null;
      }
    },
    [createAblation, ctx.sessionId, mode, setAblationDone, setAblationError, setAblationRunning, transcript, upsertSignal, userId]
  );

  const runDiagnose = async () => {
    if (!ctx.sessionId) {
      setStatusMsg("Start recording first.");
      return;
    }

    ctx.setMoodLocal("think");
    ctx.setPhase("processing");

    try {
      setStatusMsg("Finalizing recording...");
      const blob = await ctx.stopRecording();
      if (!blob) {
        setStatusMsg("No audio captured.");
        ctx.setPhase("idle");
        ctx.setMoodLocal("frown");
        return;
      }

      setStatusMsg("Transcribing...");
      const transcription = await transcribeAudio(blob);
      const cleanTranscript = transcription.transcript.trim();
      setTranscript(cleanTranscript);

      await setSessionResult({
        sessionId: ctx.sessionId,
        transcript: cleanTranscript,
      });

      setStatusMsg("Finding weak phrases...");
      const rawSegments = await identifyPhrases(cleanTranscript, mode);
      setSegments(rawSegments);

      setStatusMsg("Fetching and reranking articulation references...");
      const { fetchArticulationRefs } = await import("@/lib/exa/references");
      const { rerankRefs } = await import("@/lib/adaptation/router");
      const rawRefs = await fetchArticulationRefs(mode);
      const rankedRefs = rerankRefs(rawRefs, gapProfile?.signals ?? [], "articulation");
      setReferenceSources(rankedRefs);

      const candidates = rawSegments
        .filter((s) => s.kind === "hedge" || s.kind === "filler" || s.kind === "jargon")
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 4);

      setStatusMsg("Running phrase ablations...");
      const results = await Promise.all(
        candidates.map((s) => runSingleAblation(s.phrase, s.kind, cleanTranscript))
      );

      const scored = results.filter((r): r is NonNullable<typeof r> => Boolean(r));
      const avgScore =
        scored.length > 0
          ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length
          : 0.5;

      await setSessionResult({
        sessionId: ctx.sessionId,
        transcript: cleanTranscript,
        score: avgScore,
      });

      ctx.setMoodLocal(avgScore >= 0.6 ? "smile" : "frown");
      ctx.setPhase("reveal");

      if (scored.length > 0) {
        const best = [...scored].sort((a, b) => b.score - a.score)[0];
        ctx.setSpeaking(true);
        await speakText(
          `Strongest rewrite found. Improvement score ${(best.score * 100).toFixed(0)} percent. ${best.reasoning}`
        );
        ctx.setSpeaking(false);
      }
    } catch (err) {
      console.error("[articulation diagnose]", err);
      setStatusMsg("Analysis failed. Check keys and try again.");
      ctx.setPhase("idle");
      ctx.setMoodLocal("frown");
    }
  };

  const reset = () => {
    setTranscript("");
    setSegments([]);
    setReferenceSources([]);
    setStatusMsg("");
    ctx.setPhase("idle");
    ctx.setMoodLocal("idle");
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-[#94A3B8] text-sm max-w-xl text-center">{description}</p>

      <div className="flex gap-4">
        {ctx.phase === "idle" && (
          <button
            onClick={async () => {
              await prewarmSandboxes(2);
              await ctx.startRecording();
            }}
            className="px-6 py-3 rounded-xl bg-[#22C55E] text-[#0F172A] font-semibold hover:bg-[#16A34A] transition-colors duration-200 cursor-pointer"
          >
            {ctaLabel}
          </button>
        )}

        {ctx.phase === "recording" && (
          <button
            onClick={runDiagnose}
            className="px-6 py-3 rounded-xl bg-[#EF4444] text-white font-semibold hover:bg-red-600 transition-colors duration-200 cursor-pointer animate-pulse-green"
          >
            Diagnose
          </button>
        )}
      </div>

      {(ctx.phase === "processing" || (ctx.phase === "recording" && statusMsg)) && (
        <p className="text-[#94A3B8] text-sm animate-pulse-green">{statusMsg || "Processing..."}</p>
      )}

      {ctx.phase === "reveal" && transcript && (
        <>
          <HeatmapReveal
            transcript={transcript}
            segments={segments}
            ablationRows={ablations.map((a) => ({
              _id: String(a._id),
              inputPhrase: a.inputPhrase,
              status: a.status,
              outputText: a.outputText,
              score: a.score,
              referenceLabel: a.referenceLabel,
            }))}
            onPhraseClick={(phrase) => {
              const seg = segments.find((s) => s.phrase.toLowerCase() === phrase.toLowerCase());
              void runSingleAblation(phrase, seg?.kind ?? "neutral");
            }}
          />

          <button
            onClick={reset}
            className="mt-2 px-5 py-2 rounded-xl bg-[#1E293B] border border-[#334155] text-sm hover:border-[#22C55E] transition-colors cursor-pointer"
          >
            Try again
          </button>

          {referenceSources.length > 0 && (
            <div className="w-full p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-2">
                Reranked articulation references
              </p>
              <div className="flex flex-col gap-2">
                {referenceSources.slice(0, 3).map((ref, idx) => (
                  <a
                    key={`${ref.url}-${idx}`}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-[#0F172A] border border-[#334155] hover:border-[#22C55E]/50 transition-colors"
                  >
                    <p className="text-xs font-medium text-[#F8FAFC]">{ref.title}</p>
                    <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2">
                      {ref.rubricPoints.slice(0, 2).join(" ")}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {gapProfile && gapProfile.signals.length > 0 && (
        <div className="w-full p-4 rounded-xl bg-[#1E293B] border border-[#334155] mt-2">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-2">Your gap profile · articulation</p>
          <div className="flex flex-col gap-1">
            {[...gapProfile.signals]
              .sort((a, b) => b.missCount - a.missCount)
              .map((s) => (
                <div key={`${s.kind}-${s.identifier}`} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[#22C55E]">{s.identifier}</span>
                  <span className="text-[#94A3B8]">{s.kind}</span>
                  <span className="text-red-400">{s.missCount}✗</span>
                  <span className="text-green-400">{s.hitCount}✓</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {ctx.phase === "reveal" && actionableSegments.length === 0 && segments.length > 0 && (
        <p className="text-xs text-[#94A3B8]">No high-impact filler/hedge/jargon found in this take.</p>
      )}
    </div>
  );
}
