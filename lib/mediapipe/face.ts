// BROWSER-ONLY. Never import this in Server Components.
// Always use: const { loadFaceMesh } = await import("@/lib/mediapipe/face")

export type LandmarkPoint = { x: number; y: number; z: number };
export type LandmarkFrame = LandmarkPoint[];
export type LandmarkSequence = LandmarkFrame[];

// Unique landmark indices from FACEMESH_LIPS constant
export const LIP_INDICES = [
  0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91,
  95, 146, 178, 181, 185, 191, 267, 269, 270, 291, 308, 310, 311,
  312, 314, 317, 318, 321, 324, 375, 402, 405, 409, 415,
];

type FaceMeshLike = {
  setOptions: (options: {
    maxNumFaces: number;
    refineLandmarks: boolean;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }) => void;
  initialize: () => Promise<void>;
  onResults: (cb: (results: FaceMeshResults) => void) => void;
  send: (args: { image: HTMLCanvasElement }) => Promise<void>;
};

let instance: FaceMeshLike | null = null;

type FaceMeshResults = {
  multiFaceLandmarks?: Array<LandmarkPoint[]>;
};

function createFaceMesh(mesh: FaceMeshLike) {
  return mesh;
}

export async function loadFaceMesh() {
  if (instance) return instance;
  const { FaceMesh } = await import("@mediapipe/face_mesh");
  const mesh = new FaceMesh({
    locateFile: (f: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${f}`,
  });
  mesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  await mesh.initialize();
  instance = createFaceMesh(mesh);
  return instance;
}

export async function extractLandmarkSequence(
  videoElement: HTMLVideoElement,
  durationMs: number,
  fps = 15
): Promise<LandmarkSequence> {
  const mesh = await loadFaceMesh();
  const frameCount = Math.round((durationMs / 1000) * fps);
  const frameInterval = 1000 / fps;
  const sequence: LandmarkFrame[] = [];

  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx2d = canvas.getContext("2d")!;

  let resolveFrame: ((f: LandmarkFrame | null) => void) | null = null;

  mesh.onResults((results: FaceMeshResults) => {
    if (!resolveFrame) return;
    const raw = results.multiFaceLandmarks?.[0];
    resolveFrame(raw ?? null);
    resolveFrame = null;
  });

  for (let i = 0; i < frameCount; i++) {
    const t0 = performance.now();
    ctx2d.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const frame = await new Promise<LandmarkFrame | null>((resolve) => {
      resolveFrame = resolve;
      (mesh.send({ image: canvas }) as Promise<void>).catch(() => resolve(null));
    });

    if (frame) sequence.push(frame);

    const elapsed = performance.now() - t0;
    if (elapsed < frameInterval) {
      await new Promise((r) => setTimeout(r, frameInterval - elapsed));
    }
  }

  return sequence;
}

export function extractLipLandmarks(frame: LandmarkFrame): LandmarkPoint[] {
  return LIP_INDICES.map((i) => frame[i] ?? { x: 0, y: 0, z: 0 });
}
