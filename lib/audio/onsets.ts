export type OnsetOptions = {
  thresholdRatio?: number;
  windowMs?: number;
  minGapMs?: number;
};

export function detectOnsets(
  audioBuffer: AudioBuffer,
  thresholdRatio = 0.6,
  options: OnsetOptions = {}
): number[] {
  const windowMs = options.windowMs ?? 10;
  const minGapMs = options.minGapMs ?? 70;

  const channel = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const samplesPerWindow = Math.max(1, Math.floor((windowMs / 1000) * sampleRate));

  if (channel.length < samplesPerWindow * 2) return [];

  const rmsWindows: number[] = [];
  for (let i = 0; i < channel.length; i += samplesPerWindow) {
    const end = Math.min(channel.length, i + samplesPerWindow);
    let acc = 0;
    for (let j = i; j < end; j++) {
      const s = channel[j];
      acc += s * s;
    }
    const denom = Math.max(1, end - i);
    rmsWindows.push(Math.sqrt(acc / denom));
  }

  const maxRms = Math.max(...rmsWindows, 0);
  if (maxRms <= 1e-6) return [];

  const threshold = maxRms * thresholdRatio;
  const onsets: number[] = [];
  let lastOnset = -Infinity;

  for (let i = 1; i < rmsWindows.length; i++) {
    const current = rmsWindows[i];
    const prev = rmsWindows[i - 1];
    const rising = current > prev * 1.15;
    if (current >= threshold && (prev < threshold || rising)) {
      const tMs = i * windowMs;
      if (tMs - lastOnset >= minGapMs) {
        onsets.push(tMs);
        lastOnset = tMs;
      }
    }
  }

  return onsets;
}

export function detectSpeechWindow(
  audioBuffer: AudioBuffer,
  thresholdRatio = 0.18,
  windowMs = 20
): { startMs: number; endMs: number } {
  const channel = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const samplesPerWindow = Math.max(1, Math.floor((windowMs / 1000) * sampleRate));

  const rms: number[] = [];
  for (let i = 0; i < channel.length; i += samplesPerWindow) {
    const end = Math.min(channel.length, i + samplesPerWindow);
    let acc = 0;
    for (let j = i; j < end; j++) {
      const s = channel[j];
      acc += s * s;
    }
    rms.push(Math.sqrt(acc / Math.max(1, end - i)));
  }

  const maxRms = Math.max(...rms, 0);
  if (maxRms <= 1e-6) {
    return { startMs: 0, endMs: Math.round(audioBuffer.duration * 1000) };
  }

  const threshold = maxRms * thresholdRatio;

  let first = 0;
  while (first < rms.length && rms[first] < threshold) first += 1;

  let last = rms.length - 1;
  while (last >= 0 && rms[last] < threshold) last -= 1;

  if (first >= rms.length || last < first) {
    return { startMs: 0, endMs: Math.round(audioBuffer.duration * 1000) };
  }

  return {
    startMs: Math.max(0, first * windowMs),
    endMs: Math.min(Math.round(audioBuffer.duration * 1000), (last + 1) * windowMs),
  };
}

export function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        reject(new Error("AudioContext is not supported in this browser"));
        return;
      }
      const ctx = new Ctx();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      await ctx.close();
      resolve(audioBuffer);
    } catch (err) {
      reject(err);
    }
  });
}
