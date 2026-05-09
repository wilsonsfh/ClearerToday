const DEFAULT_VOICE_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

export async function speakText(
  text: string,
  voiceId = DEFAULT_VOICE_ID,
  options: { fallback?: "clip" | "speech" } = {}
): Promise<void> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!res.ok || !res.body) {
    console.warn("[tts] ElevenLabs TTS failed, skipping audio");
    if (options.fallback === "speech") {
      await playBrowserSpeech(text);
    } else {
      await playFallbackSpeech(text);
    }
    return;
  }

  const audioCtx = new AudioContext();
  const arrayBuffer = await res.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.start();
  await new Promise<void>((resolve) => {
    source.onended = () => resolve();
  });
}

async function playFallbackSpeech(text: string): Promise<void> {
  const clipPath = pickFallbackClip(text);
  try {
    await playAudioClip(clipPath);
    return;
  } catch {
    // fall through to speechSynthesis
  }

  if ("speechSynthesis" in window) {
    await playBrowserSpeech(text);
  }
}

function playBrowserSpeech(text: string): Promise<void> {
  if (!("speechSynthesis" in window)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function pickFallbackClip(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("bpm") || lower.includes("beat") || lower.includes("strum")) {
    return "/fallback-tts/rhythm-general.mp3";
  }
  if (
    lower.includes("tongue") ||
    lower.includes("lip") ||
    lower.includes("phoneme") ||
    lower.includes("/θ/") ||
    lower.includes("mouth")
  ) {
    return "/fallback-tts/phoneme-theta.mp3";
  }
  return "/fallback-tts/articulation-general.mp3";
}

function playAudioClip(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(src);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Fallback clip failed"));
    void audio.play().catch(reject);
  });
}
