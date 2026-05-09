"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ArticSession from "@/components/ArticSession";
import type { LandmarkSequence } from "@/lib/mediapipe/face";
import type { ComparisonResult } from "@/lib/phonemes/landmarks";
import type { PhonemeRef } from "@/lib/exa/references";
import {
  PHONEME_INVENTORY,
  describePhoneme,
  formatPhonemeList,
  inferPhonemeSymbols,
  inferPracticePlan,
  inferWordPhonemes,
  summarizeGapSignal,
  type PhonemeMatch,
  type WordPhonemePlan,
} from "@/lib/phonemes/inventory";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const MouthShapeReveal = dynamic(() => import("@/components/MouthShapeReveal"), {
  ssr: false,
});

const QUICK_FOCUS_PHONEMES = [
  { symbol: "θ", word: "think" },
  { symbol: "r", word: "run" },
  { symbol: "s", word: "see" },
  { symbol: "ʃ", word: "ship" },
];

const DEFAULT_PRACTICE_TEXT =
  "She sells seashells by the seashore. The shells she sells are seashells";

const QUICK_PROMPTS = [
  DEFAULT_PRACTICE_TEXT,
  "three thin thinkers thought through things",
  "red lorry yellow lorry",
  "fresh fried fish with thin chips",
];

type PracticeMode = "guided" | "free";

const USER_ID =
  typeof window !== "undefined"
    ? (sessionStorage.getItem("clearertoday_uid") ??
      (() => {
        const id = crypto.randomUUID();
        sessionStorage.setItem("clearertoday_uid", id);
        return id;
      })())
    : "demo";

type UnitFeedback = {
  label: string;
  kind: "word" | "idiom" | "phrase";
  startMs: number;
  endMs: number;
  targetPhoneme: string;
  targetPhonemes: PhonemeMatch[];
  comparison: ComparisonResult;
  score: number;
  reasoning: string;
  prescription: string;
  refs: PhonemeRef[];
};

type SentenceFeedback = {
  expectedText: string;
  transcriptText: string;
  summary: string;
  missingWords: string[];
  extraWords: string[];
  targetPhonemes: string[];
  practicePlan: WordPhonemePlan[];
};

type RevealData = {
  attemptFrames: LandmarkSequence;
  attemptFrameTimes: number[];
  audioUrl: string;
  primaryPhoneme: string;
  comparison: ComparisonResult;
  refs: PhonemeRef[];
  prescription: string;
  score: number;
  transcript: string;
  speechWindow: { startMs: number; endMs: number };
  unitFeedback: UnitFeedback[];
  sentenceFeedback: SentenceFeedback;
  practiceMode: PracticeMode;
};

export default function PhonemePage() {
  const [selectedPhoneme, setSelectedPhoneme] = useState("auto");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("guided");
  const [practiceText, setPracticeText] = useState(QUICK_PROMPTS[0]);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [recordingStopReason, setRecordingStopReason] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureAbortRef = useRef<AbortController | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const attemptAudioUrlRef = useRef<string | null>(null);

  const upsertSignal = useMutation(api.gapProfile.upsertSignal);
  const gapProfile = useQuery(api.gapProfile.get, {
    userId: USER_ID,
    instrument: "phoneme",
  });
  const previewText = practiceMode === "guided" ? practiceText : "";
  const previewPlan = inferPracticePlan(previewText).slice(0, 8);
  const previewPhonemes = inferPhonemeSymbols(previewText);

  useEffect(() => {
    cameraStreamRef.current = cameraStream;
    if (!videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
    if (cameraStream) {
      void videoRef.current.play().catch(() => {
        setCameraError("Camera preview is blocked. Check browser permissions.");
      });
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      captureAbortRef.current?.abort();
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (attemptAudioUrlRef.current) {
        URL.revokeObjectURL(attemptAudioUrlRef.current);
      }
    };
  }, []);

  const replaceAttemptAudioUrl = (blob: Blob) => {
    if (attemptAudioUrlRef.current) {
      URL.revokeObjectURL(attemptAudioUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    attemptAudioUrlRef.current = url;
    return url;
  };

  const clearAttemptAudioUrl = () => {
    if (!attemptAudioUrlRef.current) return;
    URL.revokeObjectURL(attemptAudioUrlRef.current);
    attemptAudioUrlRef.current = null;
  };

  const stopActiveRecording = () => {
    if (!captureAbortRef.current) return;
    setStatusMsg("Stopping recording and preparing analysis...");
    captureAbortRef.current.abort();
  };

  const runPipeline = async (ctx: Parameters<Parameters<typeof ArticSession>[0]["children"]>[0]) => {
      const expectedText = practiceMode === "guided" ? practiceText.trim() : "";
      const maxDurationMs = 120_000;
      const abortController = new AbortController();
      captureAbortRef.current = abortController;
      setCameraError("");
      setRecordingStopReason("");

      ctx.setPhase("recording");
      ctx.setMoodLocal("listening");
      setStatusMsg(
        practiceMode === "guided"
          ? "Recording. Read the practice text, then stop manually or pause for 3.5 seconds."
          : "Recording. Speak freely, then stop manually or pause for 3.5 seconds."
      );

      try {
        const { captureSpeechAndMouth } = await import("@/lib/phonemes/capture");
        const { compareToCanonical } = await import("@/lib/phonemes/landmarks");
        const {
          normalizeTranscriptWords,
          trimWordsToSpeechWindow,
          buildSpokenUnits,
          deriveTargetPhoneme,
          sliceFramesByTime,
        } = await import("@/lib/phonemes/units");
        const { fetchMouthShapeRefsForUtterance } = await import("@/lib/exa/references");
        const { rerankRefs } = await import("@/lib/adaptation/router");
        const {
          scorePhonemePronunciation,
          scorePhonemeUnit,
        } = await import("@/lib/openai/judge");
        const { transcribeAudio } = await import("@/lib/elevenlabs/scribe");

        const capture = await captureSpeechAndMouth({
          fps: 15,
          maxDurationMs,
          minSpeechMs: 500,
          initialSilenceMs: 12_000,
          silenceHoldMs: 3_500,
          signal: abortController.signal,
          onStream: (stream) => {
            setCameraStream(stream);
          },
        });
        setCameraStream(null);
        captureAbortRef.current = null;
        setRecordingStopReason(
          capture.stopReason === "manual"
            ? "Stopped manually."
            : capture.stopReason === "silence"
              ? "Stopped after 3.5 seconds of quiet."
              : capture.stopReason === "no_input"
                ? "Stopped because no speech was detected."
                : "Stopped at the maximum recording length."
        );

        ctx.setPhase("processing");
        ctx.setMoodLocal("think");
        const attemptAudioUrl = replaceAttemptAudioUrl(capture.audioBlob);

        setStatusMsg("Transcribing spoken phrase...");
        const transcription = await transcribeAudio(capture.audioBlob, expectedText);

        const normalizedWords = normalizeTranscriptWords(transcription.words ?? []);
        const speechStartMs =
          normalizedWords.length > 0
            ? normalizedWords[0].startMs
            : capture.speechStartMs;
        const speechEndMs =
          normalizedWords.length > 0
            ? normalizedWords[normalizedWords.length - 1].endMs
            : capture.speechEndMs;

        const trimmedTimeline = capture.timeline.filter(
          (f) => f.tMs >= speechStartMs && f.tMs <= speechEndMs
        );
        const trimmedFrames = trimmedTimeline.map((f) => f.frame);
        const trimmedFrameTimes = trimmedTimeline.map((f) => f.tMs);
        const fullFrames = capture.timeline.map((f) => f.frame);
        const fullFrameTimes = capture.timeline.map((f) => f.tMs);
        const usableFrames = trimmedFrames.length > 0 ? trimmedFrames : fullFrames;
        const usableFrameTimes = trimmedFrameTimes.length > 0 ? trimmedFrameTimes : fullFrameTimes;

        if (usableFrames.length === 0) {
          const primaryPhoneme =
            selectedPhoneme === "auto"
              ? deriveTargetPhoneme(expectedText || transcription.transcript || "")
              : selectedPhoneme;
          const sentenceFeedback = buildSentenceFeedback(
            expectedText,
            transcription.transcript ?? "",
            practiceMode
          );
          const comparison = compareToCanonical([], primaryPhoneme);
          setRevealData({
            attemptFrames: [],
            attemptFrameTimes: [],
            audioUrl: attemptAudioUrl,
            primaryPhoneme,
            comparison,
            refs: [],
            prescription:
              "No clear mouth landmarks were captured. Keep your face centered, improve lighting, and retry.",
            score: 0,
            transcript: transcription.transcript ?? "",
            speechWindow: { startMs: speechStartMs, endMs: speechEndMs },
            unitFeedback: [],
            sentenceFeedback,
            practiceMode,
          });
          ctx.setPhase("reveal");
          ctx.setMoodLocal("frown");
          return;
        }

        const transcriptText = (transcription.transcript ?? "").trim();
        const signals = gapProfile?.signals ?? [];

        if (!capture.speechDetected && transcriptText.length === 0) {
          const primaryPhoneme =
            selectedPhoneme === "auto" ? deriveTargetPhoneme(expectedText) : selectedPhoneme;
          const sentenceFeedback = buildSentenceFeedback(expectedText, "", practiceMode);
          const comparison = compareToCanonical([], primaryPhoneme);
          setRevealData({
            attemptFrames: [],
            attemptFrameTimes: [],
            audioUrl: attemptAudioUrl,
            primaryPhoneme,
            comparison,
            refs: [],
            prescription:
              "No speech detected yet, so this take was not scored. Click record, wait for the listening cue, then start speaking.",
            score: 0,
            transcript: "",
            speechWindow: { startMs: speechStartMs, endMs: speechEndMs },
            unitFeedback: [],
            sentenceFeedback,
            practiceMode,
          });
          ctx.setPhase("reveal");
          ctx.setMoodLocal("idle");
          return;
        }

        const primaryPhoneme =
          selectedPhoneme === "auto"
            ? deriveTargetPhoneme(expectedText || transcriptText)
            : selectedPhoneme;
        const sentenceFeedback = buildSentenceFeedback(expectedText, transcriptText, practiceMode);
        const referenceText = expectedText || transcriptText || primaryPhoneme;

        setStatusMsg("Fetching Exa references for your transcript and target phoneme...");
        const rawRefs = await fetchMouthShapeRefsForUtterance(
          referenceText,
          primaryPhoneme
        );
        const refs = rerankRefs(rawRefs, signals, "phoneme");

        setStatusMsg("Comparing your mouth shape to canonical targets...");
        const comparison = compareToCanonical(usableFrames, primaryPhoneme);

        const judgeResult = await scorePhonemePronunciation(
          primaryPhoneme,
          comparison.gapDescription,
          refs.slice(0, 2).map((r) => r.snippet)
        );

        await upsertSignal({
          userId: USER_ID,
          instrument: "phoneme",
          kind: "phoneme",
          identifier: primaryPhoneme,
          judgeScore: judgeResult.score,
        });

        setStatusMsg("Scoring each word / idiom mouth-shape attempt...");
        const wordsInWindow = trimWordsToSpeechWindow(normalizedWords, speechStartMs, speechEndMs);
        const units = buildSpokenUnits(wordsInWindow).slice(0, 10);

        const unitFeedback: UnitFeedback[] = [];

        for (const unit of units) {
          const unitFrames = sliceFramesByTime(capture.timeline, unit.startMs, unit.endMs);
          if (unitFrames.length < 2) continue;

          const targetPhonemes = inferWordPhonemes(unit.label);
          const targetPhoneme = deriveTargetPhoneme(
            unit.label,
            selectedPhoneme === "auto" ? undefined : selectedPhoneme
          );
          const unitRawRefs = await fetchMouthShapeRefsForUtterance(unit.label, targetPhoneme);
          const unitRefs = rerankRefs(unitRawRefs, signals, "phoneme");
          const unitComparison = compareToCanonical(unitFrames, targetPhoneme);
          const unitJudge = await scorePhonemeUnit(
            `${unit.kind}: ${unit.label}`,
            unitComparison.gapDescription,
            unitRefs.slice(0, 2).map((r) => r.snippet)
          );

          await upsertSignal({
            userId: USER_ID,
            instrument: "phoneme",
            kind: "phoneme",
            identifier: targetPhoneme,
            judgeScore: unitJudge.score,
          });

          unitFeedback.push({
            label: unit.label,
            kind: unit.kind,
            startMs: unit.startMs,
            endMs: unit.endMs,
            targetPhoneme,
            targetPhonemes,
            comparison: unitComparison,
            score: unitJudge.score,
            reasoning: unitJudge.reasoning,
            prescription: unitJudge.prescription,
            refs: unitRefs,
          });
        }

        unitFeedback.sort((a, b) => a.score - b.score);

        const aggregateScore =
          unitFeedback.length > 0
            ? unitFeedback.reduce((sum, u) => sum + u.score, 0) / unitFeedback.length
            : judgeResult.score;

        const finalPrescription =
          sentenceFeedback.missingWords.length > 0
            ? `First, repeat the full sentence more slowly. Missing or unclear words: ${sentenceFeedback.missingWords
                .slice(0, 5)
                .join(", ")}. Then drill: ${unitFeedback[0]?.prescription ?? judgeResult.prescription}`
            : unitFeedback[0]?.prescription ?? judgeResult.prescription;

        setRevealData({
          attemptFrames: usableFrames,
          attemptFrameTimes: usableFrameTimes,
          audioUrl: attemptAudioUrl,
          primaryPhoneme,
          comparison,
          refs,
          prescription: finalPrescription,
          score: aggregateScore,
          transcript: transcriptText,
          speechWindow: {
            startMs: speechStartMs,
            endMs: speechEndMs,
          },
          unitFeedback,
          sentenceFeedback,
          practiceMode,
        });

        ctx.setPhase("reveal");
        ctx.setMoodLocal(aggregateScore >= 0.6 ? "smile" : "frown");
      } catch (err) {
        console.error("[phoneme pipeline]", err);
        captureAbortRef.current = null;
        setCameraStream(null);
        ctx.setPhase("idle");
        ctx.setMoodLocal("frown");
        setStatusMsg("Something went wrong — check your keys and try again.");
      }
    };

  return (
    <ArticSession mode="phoneme" userId={USER_ID}>
      {(ctx) => (
        <div className="flex flex-col items-center gap-6 w-full animate-fade-in">
          <h1 className="text-2xl font-bold tracking-tight">Mouth-Shape Coach</h1>
          <p className="text-[#94A3B8] text-sm max-w-xl text-center">
            Type a word, sentence, or tongue twister, or switch to free recording.
            We infer phoneme targets, score the visible mouth shape, and explain the result in plain language.
          </p>

          <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="w-full p-4 rounded-2xl bg-[#1E293B] border border-[#334155] flex flex-col gap-4">
              <div className="flex gap-2 flex-wrap">
                {(["guided", "free"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPracticeMode(mode)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-colors cursor-pointer ${
                      practiceMode === mode
                        ? "bg-[#22C55E] text-[#0F172A] border-[#22C55E] font-semibold"
                        : "bg-[#0F172A] border-[#334155] hover:border-[#22C55E]"
                    }`}
                  >
                    {mode === "guided" ? "Read my text" : "Free recording"}
                  </button>
                ))}
              </div>

              {practiceMode === "guided" ? (
                <>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs text-[#94A3B8] uppercase tracking-wider">
                      Practice text
                    </span>
                    <textarea
                      value={practiceText}
                      onChange={(e) => setPracticeText(e.target.value)}
                      rows={3}
                      placeholder={`Try "${DEFAULT_PRACTICE_TEXT}" or any sentence you want.`}
                      className="w-full rounded-xl bg-[#0F172A] border border-[#334155] px-4 py-3 text-sm text-[#F8FAFC] outline-none focus:border-[#22C55E] resize-none"
                    />
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setPracticeText(prompt)}
                        className="px-3 py-1.5 rounded-full bg-[#0F172A] border border-[#334155] text-[11px] text-[#CBD5E1] hover:border-[#22C55E] transition-colors cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  {previewPhonemes.length > 0 && (
                    <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3">
                      <p className="text-xs text-[#94A3B8] uppercase tracking-wider">
                        Inferred targets
                      </p>
                      <p className="text-sm text-[#F8FAFC] mt-1">
                        {formatPhonemeList(previewPhonemes.slice(0, 16))}
                      </p>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {previewPlan.map((plan, index) => (
                          <span
                            key={`${plan.word}-${index}`}
                            className="text-[11px] px-2 py-1 rounded-md bg-[#1E293B] text-[#CBD5E1]"
                          >
                            {plan.word}: {formatPhonemeList(plan.phonemes.map((p) => p.symbol))}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3">
                  <p className="text-sm text-[#F8FAFC]">Speak anything.</p>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    After transcription, we infer the phoneme targets from what we heard.
                    This is more flexible but less reliable than reading a known reference sentence.
                  </p>
                </div>
              )}

              <label className="flex flex-col gap-2">
                <span className="text-xs text-[#94A3B8] uppercase tracking-wider">
                  Focus sound
                </span>
                <select
                  value={selectedPhoneme}
                  onChange={(e) => setSelectedPhoneme(e.target.value)}
                  className="rounded-xl bg-[#0F172A] border border-[#334155] px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#22C55E]"
                >
                  <option value="auto">Auto-detect from text</option>
                  {PHONEME_INVENTORY.map((profile) => (
                    <option key={profile.symbol} value={profile.symbol}>
                      {describePhoneme(profile.symbol)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <aside className="rounded-2xl bg-[#111827] border border-[#334155] p-3">
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#020617] border border-[#1E293B]">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={`h-full w-full object-cover transition-opacity duration-200 ${
                    cameraStream ? "opacity-100" : "opacity-25"
                  }`}
                />
                {!cameraStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                    <div className="mb-3 h-10 w-10 rounded-full border border-[#334155] bg-[#0F172A]" />
                    <p className="text-sm font-semibold text-[#F8FAFC]">Camera preview</p>
                    <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
                      Preview appears while recording so you can keep your face centered.
                    </p>
                  </div>
                )}
                {ctx.phase === "recording" && (
                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-500/90 px-3 py-1 text-xs font-semibold text-white">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    REC
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#64748B]">End condition</p>
                  <p className="mt-1 text-sm text-[#CBD5E1]">
                    {recordingStopReason || "Manual stop or 3.5s quiet"}
                  </p>
                </div>
                {ctx.phase === "recording" && (
                  <button
                    type="button"
                    onClick={stopActiveRecording}
                    className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-400 transition-colors cursor-pointer"
                  >
                    Stop
                  </button>
                )}
              </div>
              {cameraError && (
                <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {cameraError}
                </p>
              )}
            </aside>
          </div>

          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => setSelectedPhoneme("auto")}
              className={`px-4 py-2 rounded-lg border text-sm transition-colors duration-200 cursor-pointer ${
                selectedPhoneme === "auto"
                  ? "bg-[#22C55E] text-[#0F172A] border-[#22C55E] font-semibold"
                  : "bg-[#1E293B] border-[#334155] hover:border-[#22C55E]"
              }`}
            >
              Auto focus
            </button>
            {QUICK_FOCUS_PHONEMES.map(({ symbol, word }) => (
              <button
                key={symbol}
                onClick={() => setSelectedPhoneme(symbol)}
                className={`px-4 py-2 rounded-lg border text-sm transition-colors duration-200 cursor-pointer ${
                  selectedPhoneme === symbol
                    ? "bg-[#22C55E] text-[#0F172A] border-[#22C55E] font-semibold"
                    : "bg-[#1E293B] border-[#334155] hover:border-[#22C55E]"
                }`}
              >
                /{symbol}/ — “{word}”
              </button>
            ))}
          </div>

          {ctx.phase === "idle" && (
            <button
              onClick={() => runPipeline(ctx)}
              disabled={practiceMode === "guided" && practiceText.trim().length === 0}
              className="px-6 py-3 rounded-xl bg-[#22C55E] text-[#0F172A] font-semibold hover:bg-[#16A34A] transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {practiceMode === "guided" ? "Record This Text + Mouth Shape" : "Record Free Speech + Mouth Shape"}
            </button>
          )}

          {(ctx.phase === "recording" || ctx.phase === "processing") && (
            <p className="text-[#94A3B8] text-sm animate-pulse-green">{statusMsg}</p>
          )}

          {ctx.phase === "reveal" && revealData && (
            <>
              <MouthShapeReveal
                phoneme={selectedPhoneme}
                primaryPhoneme={revealData.primaryPhoneme}
                attemptFrames={revealData.attemptFrames}
                attemptFrameTimes={revealData.attemptFrameTimes}
                audioUrl={revealData.audioUrl}
                comparison={revealData.comparison}
                refs={revealData.refs}
                prescription={revealData.prescription}
                score={revealData.score}
                transcript={revealData.transcript}
                speechWindow={revealData.speechWindow}
                unitFeedback={revealData.unitFeedback}
                sentenceFeedback={revealData.sentenceFeedback}
                practiceMode={revealData.practiceMode}
              />
              <button
                onClick={() => {
                  clearAttemptAudioUrl();
                  setRevealData(null);
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
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-2">
                Your gap profile · phoneme adaptation
              </p>
              <div className="flex flex-col gap-1">
                {[...gapProfile.signals]
                .sort((a, b) => b.missCount - a.missCount)
                  .map((s) => (
                    <div key={`${s.kind}-${s.identifier}`} className="flex flex-col gap-0.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#22C55E]">/{s.identifier}/</span>
                        <span className="text-red-400">{s.missCount}✗</span>
                        <span className="text-green-400">{s.hitCount}✓</span>
                      </div>
                      <p className="text-[#CBD5E1]">
                        {summarizeGapSignal(s.identifier, s.missCount, s.hitCount)}
                      </p>
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

function buildSentenceFeedback(
  expectedText: string,
  transcriptText: string,
  practiceMode: PracticeMode
): SentenceFeedback {
  const basisText = expectedText || transcriptText;
  const targetPhonemes = inferPhonemeSymbols(basisText);
  const practicePlan = inferPracticePlan(basisText);

  if (practiceMode === "free") {
    return {
      expectedText: "",
      transcriptText,
      missingWords: [],
      extraWords: [],
      targetPhonemes,
      practicePlan,
      summary:
        transcriptText.trim().length > 0
          ? `Free recording detected: "${transcriptText}". Main inferred targets: ${formatPhonemeList(
              targetPhonemes.slice(0, 10)
            )}.`
          : "Free recording did not produce a transcript yet.",
    };
  }

  const expectedWords = cleanWords(expectedText);
  const transcriptWords = cleanWords(transcriptText);
  const missingWords = expectedWords.filter((word) => !transcriptWords.includes(word));
  const extraWords = transcriptWords.filter((word) => !expectedWords.includes(word));
  const matched = Math.max(0, expectedWords.length - missingWords.length);
  const ratio = expectedWords.length > 0 ? matched / expectedWords.length : 0;

  return {
    expectedText,
    transcriptText,
    missingWords,
    extraWords,
    targetPhonemes,
    practicePlan,
    summary:
      expectedWords.length === 0
        ? "No reference text was supplied."
        : `Matched about ${Math.round(ratio * 100)}% of the reference words. Main inferred targets: ${formatPhonemeList(
            targetPhonemes.slice(0, 10)
          )}.`,
  };
}

function cleanWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-z']+|[^a-z']+$/g, ""))
    .filter(Boolean);
}
