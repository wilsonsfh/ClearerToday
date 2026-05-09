"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import SpriteCharacter from "./SpriteCharacter";

type Mode = "pitch" | "concept" | "present" | "phoneme" | "guitar";
type Mood = "idle" | "listening" | "frown" | "think" | "smile" | "drill";
type Phase = "idle" | "recording" | "processing" | "reveal";

export type ArticSessionProps = {
  mode: Mode;
  userId: string;
  children: (ctx: ArticSessionContext) => React.ReactNode;
};

export type ArticSessionContext = {
  phase: Phase;
  mood: Mood;
  sessionId: Id<"sessions"> | null;
  speaking: boolean;
  startRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  setPhase: (p: Phase) => void;
  setMoodLocal: (m: Mood) => void;
  setSpeaking: (v: boolean) => void;
};

const INSTRUMENT_MAP: Record<Mode, "articulation" | "phoneme" | "guitar"> = {
  pitch: "articulation",
  concept: "articulation",
  present: "articulation",
  phoneme: "phoneme",
  guitar: "guitar",
};

export default function ArticSession({
  mode,
  userId,
  children,
}: ArticSessionProps) {
  void userId;
  const [phase, setPhase] = useState<Phase>("idle");
  const [mood, setMoodLocal] = useState<Mood>("idle");
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const createSession = useMutation(api.sessions.create);
  const setMoodRemote = useMutation(api.sessions.setMood);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: mode !== "phoneme",
      video: mode === "phoneme",
    });

    const newSessionId = await createSession({
      instrument: INSTRUMENT_MAP[mode],
      mode: mode === "pitch" || mode === "concept" || mode === "present"
        ? mode
        : undefined,
    });
    setSessionId(newSessionId);

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(100);
    mediaRecorderRef.current = recorder;

    setPhase("recording");
    setMoodLocal("listening");
    await setMoodRemote({ sessionId: newSessionId, mood: "listening" });
  }, [mode, createSession, setMoodRemote]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return null;

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      recorder.stop();
    });
  }, []);

  const ctx: ArticSessionContext = {
    phase,
    mood,
    sessionId,
    speaking,
    startRecording,
    stopRecording,
    setPhase,
    setMoodLocal,
    setSpeaking,
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0F172A] text-[#F8FAFC]">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
        <span className="text-lg font-semibold tracking-tight">ClearerToday</span>
        <div className="flex gap-4 text-sm text-[#94A3B8]">
          {(["phoneme", "pitch", "guitar"] as const).map((route) => (
            <a
              key={route}
              href={`/${route}`}
              className="hover:text-[#F8FAFC] transition-colors duration-200 cursor-pointer capitalize"
            >
              {route}
            </a>
          ))}
        </div>
      </nav>
      <main className="flex flex-col flex-1 items-center px-6 py-8 gap-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col items-center gap-3 w-full">
          <PhaseProgress phase={phase} />
          <div className="flex items-center gap-4">
            <SpriteCharacter mood={mood} speaking={speaking} size={96} />
            <MoodLabel phase={phase} />
          </div>
        </div>
        {/* eslint-disable-next-line react-hooks/refs */}
        {children(ctx)}
      </main>
    </div>
  );
}

const PHASE_ORDER: Phase[] = ["idle", "recording", "processing", "reveal"];

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Ready",
  recording: "Recording",
  processing: "Processing",
  reveal: "Reveal",
};

function MoodLabel({ phase }: { phase: Phase }) {
  const labels: Record<Phase, string> = {
    idle: "Ready when you are.",
    recording: "Listening...",
    processing: "Analysing your rep...",
    reveal: "Here's your gap.",
  };
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wider text-[#64748B]">
        Current Phase: <span className="text-[#22C55E]">{PHASE_LABELS[phase]}</span>
      </p>
      <p className="text-[#94A3B8] text-sm italic">{labels[phase]}</p>
    </div>
  );
}

function PhaseProgress({ phase }: { phase: Phase }) {
  const activeIndex = PHASE_ORDER.indexOf(phase);
  return (
    <div className="w-full rounded-xl border border-[#334155] bg-[#111827] px-3 py-2">
      <div className="grid grid-cols-4 gap-2">
        {PHASE_ORDER.map((p, idx) => {
          const isActive = idx === activeIndex;
          const isDone = idx < activeIndex;
          const base = "px-2 py-1 rounded-md text-center text-[11px] uppercase tracking-wide border";
          const stateClass = isActive
            ? "bg-[#22C55E]/20 text-[#22C55E] border-[#22C55E]/50"
            : isDone
              ? "bg-[#1E293B] text-[#CBD5E1] border-[#334155]"
              : "bg-[#0F172A] text-[#64748B] border-[#1E293B]";
          return (
            <div key={p} className={`${base} ${stateClass}`}>
              {idx + 1}. {PHASE_LABELS[p]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
