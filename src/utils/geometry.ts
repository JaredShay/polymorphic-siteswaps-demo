// Color constants mirroring CSS tokens — single source of truth for dynamic SVG attributes
export const RING_RIGHT = "#FF2D55";
export const RING_LEFT = "#22D3EE";

export const SELF_LOOP_R = 28;

export function beatPoint(
  beat: number,
  n: number,
  r: number,
  cx: number,
  cy: number,
): [number, number] {
  const ang = (-90 + beat * (360 / n)) * (Math.PI / 180);
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
}

export function ringPathFromBeats(
  beats: number[],
  n: number,
  r: number,
  cx: number,
  cy: number,
): string {
  return (
    beats
      .map((beat, j) => {
        const [x, y] = beatPoint(beat, n, r, cx, cy);
        return `${j === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export function verticesFromBeats(
  beats: number[],
  n: number,
  r: number,
  cx: number,
  cy: number,
): [number, number][] {
  return beats.map((beat) => beatPoint(beat, n, r, cx, cy));
}

// Solve ∑ arcsin(c·dᵢ) = π for c. Returns null if no solution exists
// (happens when max interval is so dominant the arcsins can't sum to π).
function solveChordalC(intervals: number[]): number | null {
  const dMax = Math.max(...intervals);
  const fAtCMax = intervals.reduce((s, d) => s + Math.asin(d / dMax), 0);
  if (fAtCMax < Math.PI) return null;
  let lo = 0,
    hi = 1 / dMax;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    intervals.reduce((s, d) => s + Math.asin(mid * d), 0) < Math.PI
      ? (lo = mid)
      : (hi = mid);
  }
  return (lo + hi) / 2;
}

// Compute vertex angles where chord_i ∝ interval_i (single-cycle, m≥3).
// Returns null when fewer than 3 beats, evenly spaced, or unsolvable.
export function chordalAngles(beats: number[], n: number): number[] | null {
  const m = beats.length;
  if (m < 3) return null;
  const intervals = beats.map((b, i) =>
    i < m - 1 ? beats[i + 1] - b : n - b + beats[0],
  );
  if (intervals.every((d) => d === intervals[0])) return null;
  const c = solveChordalC(intervals);
  if (c === null) return null;
  const startAngle = -Math.PI / 2 + (beats[0] / n) * 2 * Math.PI;
  const angles: number[] = [startAngle];
  for (let i = 0; i < m - 1; i++) {
    angles.push(angles[i] + 2 * Math.asin(c * intervals[i]));
  }
  return angles;
}

// Result of chordal layout for one hand's beats.
// effectiveBeats[i] is the original beat (mod n) for vertex i.
// beatFractions[i] is the timing fraction in [0,1) for pointOnPolygonTimed.
// intervalLabels[i] is the interval count from vertex i to vertex (i+1)%m.
// periodScale: 1 for single-cycle layout, 2 for 2-cycle layout.
export type ChordedHand = {
  angles: number[];
  effectiveBeats: number[];
  beatFractions: number[];
  intervalLabels: string[];
  periodScale: number;
};

// Try single-cycle chordal; fall back to 2-cycle for m<3 or unsolvable m=3.
// Returns null only when the rhythm is evenly spaced (no remapping needed).
export function chordalHand(beats: number[], n: number): ChordedHand | null {
  if (beats.length < 2) return null;

  // Single-cycle
  const directAngles = chordalAngles(beats, n);
  if (directAngles !== null) {
    const intervals = beats.map((b, i) =>
      i < beats.length - 1 ? beats[i + 1] - b : n - b + beats[0],
    );
    return {
      angles: directAngles,
      effectiveBeats: [...beats],
      beatFractions: beats.map((b) => b / n),
      intervalLabels: intervals.map(String),
      periodScale: 1,
    };
  }

  // 2-cycle: double the beat sequence and the period
  const doubled = [...beats, ...beats.map((b) => b + n)];
  const doubledN = n * 2;
  const intervals = doubled.map((b, i) =>
    i < doubled.length - 1 ? doubled[i + 1] - b : doubledN - b + doubled[0],
  );
  if (intervals.every((d) => d === intervals[0])) return null; // evenly spaced
  const c = solveChordalC(intervals);
  if (c === null) return null;

  // Anchor first vertex at beats[0]'s natural clock position on the ORIGINAL ring
  const startAngle = -Math.PI / 2 + (beats[0] / n) * 2 * Math.PI;
  const angles: number[] = [startAngle];
  for (let i = 0; i < doubled.length - 1; i++) {
    angles.push(angles[i] + 2 * Math.asin(c * intervals[i]));
  }
  return {
    angles,
    effectiveBeats: doubled.map((b) => b % n),
    beatFractions: doubled.map((b) => b / doubledN),
    intervalLabels: intervals.map(String),
    periodScale: 2,
  };
}

export function verticesFromAngles(
  angles: number[],
  r: number,
  cx: number,
  cy: number,
): [number, number][] {
  return angles.map((ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
}

export function ringPathFromAngles(
  angles: number[],
  r: number,
  cx: number,
  cy: number,
): string {
  return (
    angles
      .map((ang, j) => {
        const x = cx + r * Math.cos(ang);
        const y = cy + r * Math.sin(ang);
        return `${j === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export function chordParams(
  beat: number,
  value: number,
  n: number,
  r: number,
  cx: number,
  cy: number,
  beatAng?: (b: number) => number,
) {
  const ang1 = beatAng
    ? beatAng(beat)
    : -Math.PI / 2 + (beat / n) * 2 * Math.PI;
  const ang2 = beatAng
    ? beatAng((beat + value) % n)
    : -Math.PI / 2 + (((beat + value) % n) / n) * 2 * Math.PI;
  const x1 = cx + r * Math.cos(ang1);
  const y1 = cy + r * Math.sin(ang1);
  const x2 = cx + r * Math.cos(ang2);
  const y2 = cy + r * Math.sin(ang2);
  const bow = 0.16 + value / 40;
  const mx = cx + ((x1 + x2) / 2 - cx) * bow;
  const my = cy + ((y1 + y2) / 2 - cy) * bow;
  return { x1, y1, mx, my, x2, y2 };
}

export function circularArcPath(
  ox: number,
  oy: number,
  R: number,
  startAng: number,
  sweep: number,
): string {
  if (Math.abs(sweep) < 0.0001) return "";
  const steps = Math.ceil(Math.abs(sweep) / (Math.PI / 2));
  const delta = sweep / steps;
  let d = "";
  let a = startAng;
  for (let i = 0; i < steps; i++) {
    const k = (4 / 3) * Math.tan(delta / 4);
    const x1 = ox + R * Math.cos(a);
    const y1 = oy + R * Math.sin(a);
    const a2 = a + delta;
    const x2 = ox + R * Math.cos(a2);
    const y2 = oy + R * Math.sin(a2);
    const cp1x = x1 - k * R * Math.sin(a);
    const cp1y = y1 + k * R * Math.cos(a);
    const cp2x = x2 + k * R * Math.sin(a2);
    const cp2y = y2 - k * R * Math.cos(a2);
    if (i === 0) d = `M${x1.toFixed(1)} ${y1.toFixed(1)} `;
    d += `C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} `;
    a = a2;
  }
  return d.trim();
}
