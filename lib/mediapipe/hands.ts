// Optional helper for rhythm demos.
// BROWSER-ONLY. Dynamically import from client components.

export type HandLandmarkPoint = { x: number; y: number; z: number };

type HandsLike = {
  setOptions: (options: {
    maxNumHands?: number;
    modelComplexity?: 0 | 1;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }) => void;
  initialize: () => Promise<void>;
  onResults: (cb: (results: { multiHandLandmarks?: HandLandmarkPoint[][] }) => void) => void;
  send: (args: { image: HTMLCanvasElement }) => Promise<void>;
};

let handsInstance: HandsLike | null = null;

export async function loadHands() {
  if (handsInstance) return handsInstance;
  const { Hands } = await import("@mediapipe/hands");
  const hands = new Hands({
    locateFile: (f: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  await hands.initialize();
  handsInstance = hands;
  return handsInstance;
}

export async function estimateHandsFromVideo(video: HTMLVideoElement): Promise<HandLandmarkPoint[][]> {
  const hands = await loadHands();
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    hands.onResults((results: { multiHandLandmarks?: HandLandmarkPoint[][] }) => {
      resolve(results.multiHandLandmarks ?? []);
    });
    (hands.send({ image: canvas }) as Promise<void>).catch(() => resolve([]));
  });
}
