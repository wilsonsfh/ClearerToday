import { loadFaceMesh, type LandmarkFrame } from "@/lib/mediapipe/face";

export type TimedLandmarkFrame = {
  tMs: number;
  frame: LandmarkFrame;
};

export type CaptureResult = {
  audioBlob: Blob;
  timeline: TimedLandmarkFrame[];
  speechDetected: boolean;
  speechStartMs: number;
  speechEndMs: number;
  totalMs: number;
  stopReason: "silence" | "timeout" | "manual" | "no_input";
};

export type CaptureOptions = {
  fps?: number;
  maxDurationMs?: number;
  initialSilenceMs?: number;
  minSpeechMs?: number;
  silenceHoldMs?: number;
  calibrationMs?: number;
  minEnergy?: number;
  signal?: AbortSignal;
  onStream?: (stream: MediaStream) => void;
};

type FaceMeshResults = {
  multiFaceLandmarks?: Array<LandmarkFrame>;
};

export async function captureSpeechAndMouth(
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const fps = options.fps ?? 15;
  const maxDurationMs = options.maxDurationMs ?? 10_000;
  const initialSilenceMs = options.initialSilenceMs ?? 12_000;
  const minSpeechMs = options.minSpeechMs ?? 500;
  const silenceHoldMs = options.silenceHoldMs ?? 700;
  const calibrationMs = options.calibrationMs ?? 450;
  const minEnergy = options.minEnergy ?? 0.015;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: {
      facingMode: "user",
    },
  });
  options.onStream?.(stream);

  const video = document.createElement("video");
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => {
      void video.play();
      resolve();
    };
  });

  const recorderStream = new MediaStream(stream.getAudioTracks());
  const recorder = new MediaRecorder(recorderStream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(120);

  const audioCtx = new (window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext)();
  const sourceNode = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  const pcm = new Float32Array(analyser.fftSize);

  const mesh = await loadFaceMesh();
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) {
    cleanup(stream, recorder, audioCtx);
    throw new Error("Failed to create canvas context");
  }

  let resolveFrame: ((frame: LandmarkFrame | null) => void) | null = null;
  mesh.onResults((results: FaceMeshResults) => {
    if (!resolveFrame) return;
    resolveFrame(results.multiFaceLandmarks?.[0] ?? null);
    resolveFrame = null;
  });

  const timeline: TimedLandmarkFrame[] = [];
  const startTs = performance.now();
  let nextFrameDue = 0;

  let noiseAccum = 0;
  let noiseCount = 0;
  let speechStart: number | null = null;
  let lastVoice = 0;
  let voiceStreakMs = 0;
  let stopReason: CaptureResult["stopReason"] = "timeout";

  while (true) {
    const now = performance.now();
    const elapsed = now - startTs;

    if (options.signal?.aborted) {
      stopReason = "manual";
      break;
    }

    analyser.getFloatTimeDomainData(pcm);
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) {
      sum += pcm[i] * pcm[i];
    }
    const rms = Math.sqrt(sum / pcm.length);

    if (elapsed <= calibrationMs) {
      noiseAccum += rms;
      noiseCount += 1;
    }

    const noiseFloor = noiseCount > 0 ? noiseAccum / noiseCount : 0.004;
    const threshold = Math.max(minEnergy, noiseFloor * 2.8);
    const isVoice = rms >= threshold;
    voiceStreakMs = isVoice ? voiceStreakMs + 12 : 0;
    const isDistinctVoice = voiceStreakMs >= 96;

    if (isDistinctVoice) {
      if (speechStart === null) speechStart = elapsed;
      lastVoice = elapsed;
    }

    if (elapsed >= nextFrameDue) {
      ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = await new Promise<LandmarkFrame | null>((resolve) => {
        resolveFrame = resolve;
        (mesh.send({ image: canvas }) as Promise<void>).catch(() => resolve(null));
      });

      if (frame) {
        timeline.push({
          tMs: elapsed,
          frame,
        });
      }

      nextFrameDue = elapsed + 1000 / fps;
    }

    const speechDuration = speechStart !== null ? elapsed - speechStart : 0;
    const isLongEnough = speechDuration >= minSpeechMs;
    const endedBySilence = speechStart !== null && isLongEnough && elapsed - lastVoice >= silenceHoldMs;
    const endedByNoInput = speechStart === null && elapsed >= initialSilenceMs;
    const endedByTimeout = elapsed >= maxDurationMs;

    if (endedBySilence || endedByNoInput || endedByTimeout) {
      stopReason = endedBySilence ? "silence" : endedByNoInput ? "no_input" : "timeout";
      break;
    }

    await new Promise((r) => setTimeout(r, 12));
  }

  const totalMs = performance.now() - startTs;
  const speechStartMs = speechStart ?? 0;
  const speechEndMs = speechStart !== null ? Math.min(totalMs, lastVoice + 140) : totalMs;

  const audioBlob = await stopRecorder(recorder, chunks);
  cleanup(stream, recorder, audioCtx);

  return {
    audioBlob,
    timeline,
    speechDetected: speechStart !== null,
    speechStartMs,
    speechEndMs,
    totalMs,
    stopReason,
  };
}

function stopRecorder(recorder: MediaRecorder, chunks: Blob[]): Promise<Blob> {
  return new Promise((resolve) => {
    recorder.addEventListener(
      "stop",
      () => {
        resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      },
      { once: true }
    );

    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      resolve(new Blob(chunks, { type: "audio/webm" }));
    }
  });
}

function cleanup(stream: MediaStream, recorder: MediaRecorder, audioCtx: AudioContext) {
  if (recorder.state !== "inactive") {
    try {
      recorder.stop();
    } catch {
      // noop
    }
  }
  for (const t of stream.getTracks()) {
    t.stop();
  }
  void audioCtx.close();
}
