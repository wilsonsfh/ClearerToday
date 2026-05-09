export type TranscriptWord = {
  word?: string;
  text?: string;
  start_time?: number;
  end_time?: number;
  start?: number;
  end?: number;
};

export type TranscriptResult = {
  transcript: string;
  words: TranscriptWord[];
  source: "live" | "cached";
};

export async function transcribeAudio(
  audioBlob: Blob,
  referenceText?: string
): Promise<TranscriptResult> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  if (referenceText?.trim()) {
    formData.append("referenceText", referenceText.trim());
  }

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transcription failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return { ...data, source: "live" as const };
}
