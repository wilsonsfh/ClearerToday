import type { LandmarkFrame, LandmarkPoint, LandmarkSequence } from "@/lib/mediapipe/face";
import { normalizePhonemeSymbol } from "@/lib/phonemes/inventory";

// Key landmark indices used for mouth feature extraction
const L_CORNER = 61;   // left mouth corner
const R_CORNER = 291;  // right mouth corner
const UPPER_MID = 13;  // upper lip centre
const LOWER_MID = 14;  // lower lip centre
const UPPER_T = 0;     // upper lip top
const LOWER_B = 17;    // lower lip bottom

export type MouthFeatures = {
  openness: number;    // normalised vertical lip gap
  spread: number;      // normalised horizontal corner distance
  protrusion: number;  // average forward-z of lip landmarks (negative = closer to camera in MP coords)
};

// IPA-derived visible mouth-shape proxy targets.
// Values are unitless ratios; the comparison uses relative distance, not absolute.
// Some contrasts such as voicing and nasality are not visible from lips alone, so
// related sounds intentionally share or nearly share mouth targets.
export const PHONEME_TARGETS: Record<string, MouthFeatures> = {
  p: { openness: 0.0, spread: 0.26, protrusion: 0.01 },
  b: { openness: 0.0, spread: 0.26, protrusion: 0.01 },
  t: { openness: 0.015, spread: 0.34, protrusion: 0.0 },
  d: { openness: 0.015, spread: 0.34, protrusion: 0.0 },
  k: { openness: 0.04, spread: 0.34, protrusion: 0.0 },
  g: { openness: 0.04, spread: 0.34, protrusion: 0.0 },
  m: { openness: 0.0, spread: 0.28, protrusion: 0.01 },
  n: { openness: 0.02, spread: 0.34, protrusion: 0.0 },
  ŋ: { openness: 0.04, spread: 0.34, protrusion: 0.0 },
  f: { openness: 0.01, spread: 0.32, protrusion: 0.0 },
  v: { openness: 0.01, spread: 0.32, protrusion: 0.0 },
  θ: { openness: 0.02, spread: 0.35, protrusion: 0.0 },
  ð: { openness: 0.02, spread: 0.35, protrusion: 0.0 },
  s: { openness: 0.01, spread: 0.38, protrusion: 0.0 },
  z: { openness: 0.01, spread: 0.38, protrusion: 0.0 },
  ʃ: { openness: 0.02, spread: 0.28, protrusion: 0.04 },
  ʒ: { openness: 0.02, spread: 0.28, protrusion: 0.04 },
  h: { openness: 0.06, spread: 0.34, protrusion: 0.0 },
  tʃ: { openness: 0.02, spread: 0.28, protrusion: 0.04 },
  dʒ: { openness: 0.02, spread: 0.28, protrusion: 0.04 },
  l: { openness: 0.035, spread: 0.34, protrusion: 0.0 },
  r: { openness: 0.04, spread: 0.25, protrusion: 0.03 },
  w: { openness: 0.035, spread: 0.2, protrusion: 0.07 },
  j: { openness: 0.025, spread: 0.44, protrusion: 0.0 },
  i: { openness: 0.02, spread: 0.48, protrusion: 0.0 },
  ɪ: { openness: 0.035, spread: 0.42, protrusion: 0.0 },
  e: { openness: 0.04, spread: 0.44, protrusion: 0.0 },
  ɛ: { openness: 0.055, spread: 0.42, protrusion: 0.0 },
  æ: { openness: 0.09, spread: 0.45, protrusion: 0.0 },
  ə: { openness: 0.045, spread: 0.32, protrusion: 0.0 },
  ʌ: { openness: 0.06, spread: 0.34, protrusion: 0.0 },
  ɑ: { openness: 0.1, spread: 0.34, protrusion: 0.0 },
  ɔ: { openness: 0.08, spread: 0.25, protrusion: 0.05 },
  oʊ: { openness: 0.045, spread: 0.23, protrusion: 0.06 },
  ʊ: { openness: 0.04, spread: 0.24, protrusion: 0.05 },
  u: { openness: 0.03, spread: 0.2, protrusion: 0.07 },
  aɪ: { openness: 0.08, spread: 0.4, protrusion: 0.0 },
  aʊ: { openness: 0.08, spread: 0.25, protrusion: 0.05 },
  ɔɪ: { openness: 0.06, spread: 0.32, protrusion: 0.04 },
  ɝ: { openness: 0.045, spread: 0.25, protrusion: 0.035 },
  ɚ: { openness: 0.04, spread: 0.26, protrusion: 0.03 },
};

export function computeMouthFeatures(frame: LandmarkFrame): MouthFeatures {
  const lc = frame[L_CORNER] ?? { x: 0, y: 0, z: 0 };
  const rc = frame[R_CORNER] ?? { x: 0, y: 0, z: 0 };
  const up = frame[UPPER_MID] ?? { x: 0, y: 0, z: 0 };
  const lo = frame[LOWER_MID] ?? { x: 0, y: 0, z: 0 };

  const spread = Math.hypot(rc.x - lc.x, rc.y - lc.y);
  const openness = Math.abs(lo.y - up.y);

  const lipIndices = [L_CORNER, R_CORNER, UPPER_MID, LOWER_MID, UPPER_T, LOWER_B];
  const avgZ = lipIndices.reduce((s, i) => s + (frame[i]?.z ?? 0), 0) / lipIndices.length;
  const protrusion = -avgZ; // MP z is negative when closer to camera

  return { openness, spread, protrusion };
}

export function featureDistance(a: MouthFeatures, b: MouthFeatures): number {
  const dO = a.openness - b.openness;
  const dS = a.spread - b.spread;
  const dP = a.protrusion - b.protrusion;
  // Weight openness 2× since it's most diagnostic for phoneme contrast
  return Math.sqrt(2 * dO * dO + dS * dS + dP * dP);
}

export type ComparisonResult = {
  divergentFrameIndex: number;
  divergentFeatures: MouthFeatures;
  targetFeatures: MouthFeatures;
  perFrameDistance: number[];
  avgDistance: number;
  gapDescription: string;
};

export function compareToCanonical(
  sequence: LandmarkSequence,
  phoneme: string
): ComparisonResult {
  const normalizedPhoneme = normalizePhonemeSymbol(phoneme);
  const target = PHONEME_TARGETS[normalizedPhoneme] ?? PHONEME_TARGETS.ə;
  if (sequence.length === 0) {
    return {
      divergentFrameIndex: 0,
      divergentFeatures: target,
      targetFeatures: target,
      perFrameDistance: [],
      avgDistance: 1,
      gapDescription:
        `No mouth landmarks were detected for /${normalizedPhoneme}/. Keep your face centered, ` +
        "increase lighting, and retry.",
    };
  }

  const perFrameDistance: number[] = [];

  for (const frame of sequence) {
    const features = computeMouthFeatures(frame);
    perFrameDistance.push(featureDistance(features, target));
  }

  const divergentFrameIndex = perFrameDistance.indexOf(
    Math.max(...perFrameDistance)
  );
  const avgDistance =
    perFrameDistance.reduce((s, d) => s + d, 0) / (perFrameDistance.length || 1);

  const divergentFeatures = sequence[divergentFrameIndex]
    ? computeMouthFeatures(sequence[divergentFrameIndex])
    : target;

  const gapDescription = buildGapDescription(divergentFeatures, target, normalizedPhoneme);

  return {
    divergentFrameIndex,
    divergentFeatures,
    targetFeatures: target,
    perFrameDistance,
    avgDistance,
    gapDescription,
  };
}

function buildGapDescription(
  actual: MouthFeatures,
  target: MouthFeatures,
  phoneme: string
): string {
  const gaps: string[] = [];

  const openDiff = actual.openness - target.openness;
  if (Math.abs(openDiff) > 0.01) {
    gaps.push(openDiff > 0 ? "mouth too open" : "mouth too closed");
  }

  const spreadDiff = actual.spread - target.spread;
  if (Math.abs(spreadDiff) > 0.03) {
    gaps.push(spreadDiff > 0 ? "lips too wide" : "lips not spread enough");
  }

  const protDiff = actual.protrusion - target.protrusion;
  if (Math.abs(protDiff) > 0.02) {
    gaps.push(protDiff > 0 ? "too much lip protrusion" : "lips not forward enough");
  }

  if (gaps.length === 0) return `/${phoneme}/ shape looks close — keep practising.`;
  return `For /${phoneme}/: ${gaps.join(", ")}.`;
}

// Draw lip landmarks onto a canvas, scaling to canvas dimensions
export function drawLipLandmarks(
  ctx: CanvasRenderingContext2D,
  frame: LandmarkFrame,
  color: string,
  canvasWidth: number,
  canvasHeight: number
) {
  const lipIndices = [
    61, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14,
    87, 178, 88, 95, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
  ];
  const outerLipLoop = [
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17,
    84, 181, 91, 146,
  ];
  const innerLipLoop = [
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14,
    87, 178, 88, 95,
  ];

  const rawPoints = lipIndices
    .map((idx) => frame[idx])
    .filter((p): p is LandmarkPoint => Boolean(p));
  if (rawPoints.length === 0) return;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of rawPoints) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const boxWNorm = Math.max(0.05, maxX - minX);
  const boxHNorm = Math.max(0.05, maxY - minY);
  const padX = boxWNorm * 0.45;
  const padY = boxHNorm * 0.65;

  const zoomMinX = minX - padX;
  const zoomMaxX = maxX + padX;
  const zoomMinY = minY - padY;
  const zoomMaxY = maxY + padY;
  const zoomW = Math.max(1e-4, zoomMaxX - zoomMinX);
  const zoomH = Math.max(1e-4, zoomMaxY - zoomMinY);

  const targetW = canvasWidth * 0.88;
  const targetH = canvasHeight * 0.82;
  const scale = Math.min(targetW / (zoomW * canvasWidth), targetH / (zoomH * canvasHeight));
  const translateX = canvasWidth / 2 - ((zoomMinX + zoomMaxX) / 2) * canvasWidth * scale;
  const translateY = canvasHeight / 2 - ((zoomMinY + zoomMaxY) / 2) * canvasHeight * scale;

  const project = (pt: LandmarkPoint) => ({
    x: pt.x * canvasWidth * scale + translateX,
    y: pt.y * canvasHeight * scale + translateY,
  });

  const drawLoop = (indices: number[]) => {
    let hasStart = false;
    for (let i = 0; i < indices.length; i++) {
      const lm = frame[indices[i]];
      if (!lm) continue;
      const { x, y } = project(lm);
      if (!hasStart) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        hasStart = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (hasStart) {
      ctx.closePath();
    }
    return hasStart;
  };

  // Fill mouth region for stronger shape visibility.
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = color;
  if (drawLoop(outerLipLoop)) {
    ctx.fill();
  }
  ctx.restore();

  // Strong contour lines for lip shape.
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  if (drawLoop(outerLipLoop)) {
    ctx.stroke();
  }
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 2;
  if (drawLoop(innerLipLoop)) {
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Landmark dots.
  ctx.fillStyle = color;
  for (const idx of lipIndices) {
    const lm = frame[idx];
    if (!lm) continue;
    const { x, y } = project(lm);
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Emphasize diagnostic points.
  const highlightPoints = [L_CORNER, R_CORNER, UPPER_MID, LOWER_MID];
  ctx.fillStyle = "#F8FAFC";
  for (const idx of highlightPoints) {
    const lm = frame[idx];
    if (!lm) continue;
    const { x, y } = project(lm);
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draw canonical phoneme shape as a static diagram
export function drawCanonicalShape(
  ctx: CanvasRenderingContext2D,
  phoneme: string,
  canvasWidth: number,
  canvasHeight: number
) {
  const normalizedPhoneme = normalizePhonemeSymbol(phoneme);
  const target = PHONEME_TARGETS[normalizedPhoneme] ?? PHONEME_TARGETS.ə;
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2 - 8;

  const spread = target.spread * canvasWidth * 1.5;
  const openness = Math.max(10, target.openness * canvasHeight * 10);
  const lipThickness = Math.max(12, openness * 0.45);

  ctx.save();
  ctx.fillStyle = "rgba(34, 197, 94, 0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, spread / 2, lipThickness, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#22C55E";
  ctx.lineWidth = 3;

  // Upper lip arc
  ctx.beginPath();
  ctx.ellipse(cx, cy - openness / 2, spread / 2, lipThickness, 0, Math.PI, 0);
  ctx.stroke();

  // Lower lip arc
  ctx.beginPath();
  ctx.ellipse(cx, cy + openness / 2, spread / 2, lipThickness, 0, 0, Math.PI);
  ctx.stroke();

  // Corner dots
  ctx.fillStyle = "#22C55E";
  ctx.beginPath();
  ctx.arc(cx - spread / 2, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + spread / 2, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  // Phoneme label
  ctx.fillStyle = "#94A3B8";
  ctx.font = "14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`/${normalizedPhoneme}/ canonical mouth shape`, cx, cy + lipThickness + 40);
}
