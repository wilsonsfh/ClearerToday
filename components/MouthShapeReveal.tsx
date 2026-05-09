"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LandmarkSequence } from "@/lib/mediapipe/face";
import { drawLipLandmarks, drawCanonicalShape } from "@/lib/phonemes/landmarks";
import type { ComparisonResult } from "@/lib/phonemes/landmarks";
import type { PhonemeRef } from "@/lib/exa/references";
import { speakText } from "@/lib/elevenlabs/tts";
import { describePhoneme, formatPhonemeList, phonemeCue, type PhonemeMatch, type WordPhonemePlan } from "@/lib/phonemes/inventory";

type MouthShapeRevealProps = {
  phoneme: string;
  primaryPhoneme?: string;
  attemptFrames: LandmarkSequence;
  attemptFrameTimes?: number[];
  audioUrl?: string;
  comparison: ComparisonResult;
  refs: PhonemeRef[];
  prescription: string;
  score: number;
  transcript?: string;
  speechWindow?: { startMs: number; endMs: number };
  unitFeedback?: Array<{
    label: string;
    kind: "word" | "idiom" | "phrase";
    startMs: number;
    endMs: number;
    targetPhoneme: string;
    targetPhonemes?: PhonemeMatch[];
    comparison?: ComparisonResult;
    score: number;
    reasoning: string;
    prescription: string;
    refs: PhonemeRef[];
  }>;
  sentenceFeedback?: {
    expectedText: string;
    transcriptText: string;
    summary: string;
    missingWords: string[];
    extraWords: string[];
    targetPhonemes: string[];
    practicePlan: WordPhonemePlan[];
  };
  practiceMode?: "guided" | "free";
};

function clampFrameIndex(idx: number, totalFrames: number): number {
  if (totalFrames <= 0) return 0;
  if (!Number.isFinite(idx)) return 0;
  return Math.min(totalFrames - 1, Math.max(0, Math.round(idx)));
}

function nearestFrameIndexForTime(
  frameTimes: number[],
  timeMs: number,
  totalFrames: number
): number | null {
  if (frameTimes.length !== totalFrames || totalFrames === 0) return null;
  if (timeMs <= frameTimes[0]) return 0;
  if (timeMs >= frameTimes[totalFrames - 1]) return totalFrames - 1;

  let lo = 0;
  let hi = totalFrames - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (frameTimes[mid] < timeMs) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const after = clampFrameIndex(lo, totalFrames);
  const before = clampFrameIndex(lo - 1, totalFrames);
  return Math.abs(frameTimes[before] - timeMs) <= Math.abs(frameTimes[after] - timeMs)
    ? before
    : after;
}

export default function MouthShapeReveal({
  phoneme,
  primaryPhoneme,
  attemptFrames,
  attemptFrameTimes = [],
  audioUrl,
  comparison,
  refs,
  prescription,
  score,
  transcript,
  speechWindow,
  unitFeedback = [],
  sentenceFeedback,
  practiceMode = "guided",
}: MouthShapeRevealProps) {
  const displayPhoneme = primaryPhoneme ?? (phoneme === "auto" ? "ə" : phoneme);
  const attemptRef = useRef<HTMLCanvasElement>(null);
  const refCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const totalFrames = attemptFrames.length;
  const [currentFrame, setCurrentFrame] = useState(() =>
    clampFrameIndex(comparison.divergentFrameIndex, totalFrames)
  );
  const [playingLabel, setPlayingLabel] = useState<string | null>(null);
  const [speakingLabel, setSpeakingLabel] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFrames = totalFrames > 0;
  const canPlay = totalFrames > 1;
  const maxFrameIndex = Math.max(0, totalFrames - 1);
  const safeCurrentFrame = clampFrameIndex(currentFrame, totalFrames);
  const divergentFrameIndex = clampFrameIndex(comparison.divergentFrameIndex, totalFrames);
  const speechStartMs = speechWindow?.startMs ?? 0;
  const speechEndMs =
    speechWindow?.endMs ?? speechStartMs + Math.max(1, totalFrames - 1) * 80;
  const speechDurationMs = Math.max(1, speechEndMs - speechStartMs);

  // Draw a single frame to canvases
  const drawFrame = useCallback((idx: number) => {
    const clampedIdx = clampFrameIndex(idx, totalFrames);
    const frame = hasFrames ? attemptFrames[clampedIdx] : undefined;

    const ac = attemptRef.current;
    const rc = refCanvasRef.current;
    if (!ac || !rc) return;

    const actx = ac.getContext("2d")!;
    const rctx = rc.getContext("2d")!;

    // Clear
    actx.fillStyle = "#0F172A";
    actx.fillRect(0, 0, ac.width, ac.height);
    rctx.fillStyle = "#0F172A";
    rctx.fillRect(0, 0, rc.width, rc.height);

    // Highlight divergent frame
    const isDivergent = hasFrames && clampedIdx === divergentFrameIndex;
    if (isDivergent) {
      actx.strokeStyle = "#EF4444";
      actx.lineWidth = 3;
      actx.strokeRect(2, 2, ac.width - 4, ac.height - 4);
    }

    // Attempt landmarks
    if (frame) {
      drawLipLandmarks(actx, frame, isDivergent ? "#EF4444" : "#22C55E", ac.width, ac.height);
    } else {
      actx.fillStyle = "#94A3B8";
      actx.font = "13px Inter, sans-serif";
      actx.textAlign = "center";
      actx.fillText("No face landmarks detected.", ac.width / 2, ac.height / 2 - 8);
      actx.fillText("Move closer and keep your mouth in frame.", ac.width / 2, ac.height / 2 + 12);
      actx.textAlign = "left";
    }

    // Reference canonical shape
    drawCanonicalShape(rctx, displayPhoneme, rc.width, rc.height);

    // Frame label
    actx.fillStyle = "#94A3B8";
    actx.font = "11px Inter, sans-serif";
    actx.fillText(
      hasFrames
        ? `Frame ${clampedIdx + 1}/${totalFrames}${isDivergent ? " ← divergent" : ""}`
        : "Frame 0/0",
      8,
      16
    );
  }, [attemptFrames, displayPhoneme, divergentFrameIndex, hasFrames, totalFrames]);

  // Initial draw on mount and when frame changes
  useEffect(() => {
    drawFrame(safeCurrentFrame);
  }, [drawFrame, safeCurrentFrame]);

  const frameFromCaptureTime = useCallback((timeMs: number) => {
    if (!hasFrames) return 0;
    const nearest = nearestFrameIndexForTime(attemptFrameTimes, timeMs, totalFrames);
    if (nearest !== null) return nearest;
    const ratio = (timeMs - speechStartMs) / speechDurationMs;
    return clampFrameIndex(ratio * maxFrameIndex, totalFrames);
  }, [
    attemptFrameTimes,
    hasFrames,
    maxFrameIndex,
    speechDurationMs,
    speechStartMs,
    totalFrames,
  ]);

  const stopPlayback = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingLabel(null);
  }, []);

  const startFrameOnlyPlayback = useCallback((label: string) => {
    if (!canPlay) {
      stopPlayback();
      setCurrentFrame(0);
      return;
    }

    stopPlayback();
    setPlayingLabel(label);
    let f = safeCurrentFrame;
    const step = () => {
      setCurrentFrame(f);
      f = (f + 1) % totalFrames;
      timeoutRef.current = setTimeout(() => {
        animRef.current = requestAnimationFrame(step);
      }, 80);
    };
    step();
  }, [canPlay, safeCurrentFrame, stopPlayback, totalFrames]);

  const playAttemptSegment = useCallback(async (startMs: number, endMs: number, label: string) => {
    const safeStartMs = Math.max(0, startMs);
    const safeEndMs = Math.max(safeStartMs + 120, endMs);

    if (!audioUrl || !audioRef.current) {
      startFrameOnlyPlayback(label);
      return;
    }

    stopPlayback();
    const audio = audioRef.current;
    setPlayingLabel(label);
    setCurrentFrame(frameFromCaptureTime(safeStartMs));
    audio.currentTime = safeStartMs / 1000;

    const sync = () => {
      const currentMs = audio.currentTime * 1000;
      setCurrentFrame(frameFromCaptureTime(Math.min(currentMs, safeEndMs)));

      if (audio.paused || currentMs >= safeEndMs) {
        stopPlayback();
        return;
      }

      animRef.current = requestAnimationFrame(sync);
    };

    try {
      await audio.play();
      animRef.current = requestAnimationFrame(sync);
    } catch {
      stopPlayback();
    }
  }, [audioUrl, frameFromCaptureTime, startFrameOnlyPlayback, stopPlayback]);

  const togglePlay = () => {
    if (playingLabel === "attempt") {
      stopPlayback();
      return;
    }
    void playAttemptSegment(speechStartMs, speechEndMs, "attempt");
  };

  useEffect(() => {
    return stopPlayback;
  }, [stopPlayback]);

  const speak = async (label: string, text: string, fallback: "clip" | "speech" = "clip") => {
    stopPlayback();
    setSpeakingLabel(label);
    try {
      await speakText(text, undefined, { fallback });
    } finally {
      setSpeakingLabel(null);
    }
  };

  const scoreColor =
    score >= 0.7 ? "text-green-400" : score >= 0.4 ? "text-yellow-400" : "text-red-400";
  const scoreLabel =
    score >= 0.7 ? "Good" : score >= 0.4 ? "Getting there" : "Needs work";

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onEnded={stopPlayback}
          className="hidden"
        />
      )}

      {/* Score header */}
      <div className="flex items-center gap-3">
        <span className={`text-3xl font-bold ${scoreColor}`}>
          {Math.round(score * 100)}
        </span>
        <div>
          <p className={`font-semibold ${scoreColor}`}>{scoreLabel}</p>
          <p className="text-xs text-[#94A3B8]">{describePhoneme(displayPhoneme)} accuracy</p>
        </div>
      </div>

      {sentenceFeedback && (
        <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">
            {practiceMode === "free" ? "Free speech analysis" : "Sentence analysis"}
          </p>
          <p className="text-sm text-[#F8FAFC]">{sentenceFeedback.summary}</p>
          {sentenceFeedback.expectedText && (
            <p className="text-xs text-[#94A3B8] mt-2">
              Target: &ldquo;{sentenceFeedback.expectedText}&rdquo;
            </p>
          )}
          {sentenceFeedback.transcriptText && (
            <p className="text-xs text-[#94A3B8] mt-1">
              Heard: &ldquo;{sentenceFeedback.transcriptText}&rdquo;
            </p>
          )}
          {sentenceFeedback.missingWords.length > 0 && (
            <p className="text-xs text-yellow-400 mt-2">
              Missing or unclear: {sentenceFeedback.missingWords.slice(0, 8).join(", ")}
            </p>
          )}
          {sentenceFeedback.extraWords.length > 0 && (
            <p className="text-xs text-[#94A3B8] mt-1">
              Extra words heard: {sentenceFeedback.extraWords.slice(0, 8).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Side-by-side canvases */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2 flex-1">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider">Your attempt</p>
          <canvas
            ref={attemptRef}
            width={420}
            height={280}
            className="w-full max-w-[420px] rounded-xl border border-[#334155] bg-[#0F172A]"
          />
          <p className="text-[11px] text-[#94A3B8]">Zoomed mouth region with lip contour overlay</p>
        </div>
        <div className="flex flex-col items-center gap-2 flex-1">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider">Reference /{displayPhoneme}/</p>
          <canvas
            ref={refCanvasRef}
            width={420}
            height={280}
            className="w-full max-w-[420px] rounded-xl border border-[#22C55E]/30 bg-[#0F172A]"
          />
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!canPlay}
            className="px-3 py-1.5 rounded-lg bg-[#1E293B] border border-[#334155] text-xs hover:border-[#22C55E] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {playingLabel === "attempt" && canPlay ? "Pause attempt" : "Play attempt"}
          </button>
          <span className="text-xs text-[#94A3B8]">
            Frame {hasFrames ? safeCurrentFrame + 1 : 0} / {totalFrames}
          </span>
          {audioUrl && (
            <span className="text-xs text-[#64748B]">
              audio-synced
            </span>
          )}
          {hasFrames && safeCurrentFrame === divergentFrameIndex && (
            <span className="text-xs text-red-400 font-medium">← max divergence</span>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={maxFrameIndex}
          value={safeCurrentFrame}
          disabled={!hasFrames}
          onChange={(e) => {
            stopPlayback();
            setCurrentFrame(Number(e.target.value));
          }}
          className="w-full accent-green-500 cursor-pointer"
          aria-label="Frame scrubber"
        />
        {/* Distance bar */}
        <div className="flex gap-0.5 h-6">
          {comparison.perFrameDistance.length === 0 && (
            <div className="w-full rounded-sm bg-[#1E293B] border border-[#334155] flex items-center justify-center">
              <span className="text-[11px] text-[#94A3B8]">No frame distances yet</span>
            </div>
          )}
          {comparison.perFrameDistance.map((d, i) => {
            const maxD = Math.max(...comparison.perFrameDistance, 0.01);
            const h = Math.min(100, (d / maxD) * 100);
            const isDivergent = i === divergentFrameIndex;
            return (
              <div
                key={i}
                className="flex-1 flex items-end cursor-pointer"
                onClick={() => {
                  stopPlayback();
                  setCurrentFrame(i);
                }}
                title={`Frame ${i + 1}: distance ${d.toFixed(3)}`}
              >
                <div
                  className={`w-full rounded-sm transition-all ${isDivergent ? "bg-red-500" : "bg-green-500/40"}`}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[#94A3B8] mt-1">
          Bar height = deviation from /{displayPhoneme}/ target · Red bar = divergent frame
        </p>
        {!hasFrames && (
          <p className="text-xs text-yellow-400">
            We could not detect a face in this take. Keep your whole mouth visible and try again.
          </p>
        )}
      </div>

      {/* Prescription */}
      <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-1">Drill prescription</p>
          <button
            type="button"
            onClick={() => void speak("drill", prescription)}
            className="shrink-0 rounded-lg border border-[#334155] bg-[#0F172A] px-3 py-1.5 text-xs text-[#F8FAFC] hover:border-[#22C55E] transition-colors cursor-pointer"
          >
            {speakingLabel === "drill" ? "Playing..." : "Play drill"}
          </button>
        </div>
        <p className="text-sm text-[#F8FAFC]">{prescription}</p>
        <p className="text-xs text-[#94A3B8] mt-2">
          Focus cue: {phonemeCue(displayPhoneme)}
        </p>
        {transcript && (
          <p className="text-xs text-[#94A3B8] mt-2">Transcript: “{transcript}”</p>
        )}
        {speechWindow && (
          <p className="text-xs text-[#94A3B8] mt-1">
            Scoring window: {Math.max(0, Math.round(speechWindow.startMs))}ms to{" "}
            {Math.max(0, Math.round(speechWindow.endMs))}ms (leading/trailing silence trimmed)
          </p>
        )}
      </div>

      {unitFeedback.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider">
            Per-word / phrase optimization
          </p>
          {unitFeedback.map((unit, idx) => {
            const color =
              unit.score >= 0.7 ? "text-green-400" : unit.score >= 0.45 ? "text-yellow-400" : "text-red-400";
            const unitLabel = `${unit.kind}-${idx}`;
            const referenceSources = unit.refs.slice(0, 3);
            return (
              <div key={`${unit.kind}-${unit.label}-${idx}`} className="p-3 rounded-lg bg-[#1E293B] border border-[#334155]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-[#F8FAFC]">
                    {unit.kind === "idiom" ? "Idiom" : unit.kind === "phrase" ? "Phrase" : "Word"}: “{unit.label}”
                  </p>
                  <span className={`text-xs font-semibold ${color}`}>{Math.round(unit.score * 100)}%</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (playingLabel === unitLabel) {
                        stopPlayback();
                        return;
                      }
                      void playAttemptSegment(unit.startMs, unit.endMs, unitLabel);
                    }}
                    className="rounded-lg border border-[#334155] bg-[#0F172A] px-3 py-1.5 text-xs text-[#F8FAFC] hover:border-[#22C55E] transition-colors cursor-pointer"
                  >
                    {playingLabel === unitLabel ? "Pause attempt" : "Play your attempt"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void speak(unitLabel, unit.label, "speech")}
                    className="rounded-lg border border-[#22C55E]/40 bg-[#10251A] px-3 py-1.5 text-xs text-[#D1FAE5] hover:border-[#22C55E] transition-colors cursor-pointer"
                  >
                    {speakingLabel === unitLabel ? "Playing target..." : "Play target word"}
                  </button>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Target shape: /{unit.targetPhoneme}/ · {unit.reasoning}
                </p>
                {unit.targetPhonemes && unit.targetPhonemes.length > 0 && (
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Inferred sequence: {formatPhonemeList(unit.targetPhonemes.map((p) => p.symbol))}
                  </p>
                )}
                {unit.comparison && (
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Mouth-shape gap: {unit.comparison.gapDescription}
                  </p>
                )}
                <p className="text-[11px] text-[#64748B] mt-1">
                  Attempt window: {Math.round(unit.startMs)}ms to {Math.round(unit.endMs)}ms. Target audio is manual and synthetic; sources below are used as pronunciation references.
                </p>
                <p className="text-xs text-[#CBD5E1] mt-1">{unit.prescription}</p>
                {referenceSources.length > 0 && (
                  <div className="mt-3 border-t border-[#334155] pt-2">
                    <p className="text-[11px] uppercase tracking-wider text-[#64748B]">
                      Source of truth
                    </p>
                    <div className="mt-1 flex flex-col gap-1">
                      {referenceSources.map((ref, refIdx) => (
                        <a
                          key={`${ref.url}-${refIdx}`}
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#22C55E] hover:underline"
                        >
                          {refIdx + 1}. {ref.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Exa references */}
      {refs.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#94A3B8] uppercase tracking-wider">Reference sources (via Exa)</p>
          {refs.slice(0, 3).map((ref, i) => (
            <a
              key={i}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-[#1E293B] border border-[#334155] hover:border-[#22C55E]/50 transition-colors cursor-pointer group"
            >
              <p className="text-xs font-medium text-[#F8FAFC] group-hover:text-[#22C55E] transition-colors">
                {ref.title}
              </p>
              {ref.snippet && (
                <p className="text-xs text-[#94A3B8] mt-1 line-clamp-2">{ref.snippet}</p>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
