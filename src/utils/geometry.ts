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

// Compute vertex angles that make chord_i ∝ interval_i, so constant-speed
// traversal spends time proportional to each interval.
//
// Returns null when: fewer than 3 beats, evenly spaced (current approach is
// already exact), or the max interval dominates so much the equation has no
// solution.
export function chordalAngles(beats: number[], n: number): number[] | null {
  const m = beats.length;
  if (m < 3) return null;

  const intervals = beats.map((b, i) =>
    i < m - 1 ? beats[i + 1] - b : n - b + beats[0],
  );

  // Evenly spaced: current approach already exact
  if (intervals.every((d) => d === intervals[0])) return null;

  // Solve ∑ arcsin(c·dᵢ) = π — check it's solvable first
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
  const c = (lo + hi) / 2;

  // Place first vertex at its natural clock position; space the rest chorally
  const startAngle = -Math.PI / 2 + (beats[0] / n) * 2 * Math.PI;
  const angles: number[] = [startAngle];
  for (let i = 0; i < m - 1; i++) {
    angles.push(angles[i] + 2 * Math.asin(c * intervals[i]));
  }
  return angles;
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
) {
  const [x1, y1] = beatPoint(beat, n, r, cx, cy);
  const [x2, y2] = beatPoint((beat + value) % n, n, r, cx, cy);
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
