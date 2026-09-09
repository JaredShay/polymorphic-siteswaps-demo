export const LOOP_MS = 4000;

// Fast at release, slow at apex, fast at catch.
export function throwEasing(t: number): number {
  const physical =
    t < 0.5 ? Math.sin(Math.PI * t) / 2 : 1 - Math.sin(Math.PI * t) / 2;
  return 0.35 * physical + 0.65 * t;
}

export function pointOnPolygon(
  verts: [number, number][],
  progress: number,
): [number, number] {
  const total = progress * verts.length;
  const edge = Math.floor(total) % verts.length;
  const t = total - Math.floor(total);
  const [x1, y1] = verts[edge];
  const [x2, y2] = verts[(edge + 1) % verts.length];
  return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
}

// Time-proportional polygon traversal: tracer spends time on each edge
// proportional to the actual beat interval, not equal time per edge.
// beatFractions = beats.map(b => b / n)
export function pointOnPolygonTimed(
  verts: [number, number][],
  beatFractions: number[],
  progress: number,
): [number, number] {
  const len = verts.length;
  let edge = len - 1;
  for (let i = 0; i < len - 1; i++) {
    if (progress < beatFractions[i + 1]) {
      edge = i;
      break;
    }
  }
  const edgeStart = beatFractions[edge];
  const edgeEnd = edge < len - 1 ? beatFractions[edge + 1] : 1.0;
  const t = edgeEnd > edgeStart ? (progress - edgeStart) / (edgeEnd - edgeStart) : 0;
  const [x1, y1] = verts[edge];
  const [x2, y2] = verts[(edge + 1) % len];
  return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
}

// Returns the index of the current polygon edge based on beat fractions.
export function currentEdgeIndex(beatFractions: number[], progress: number): number {
  let edge = 0;
  for (let i = 0; i < beatFractions.length; i++) {
    if (beatFractions[i] <= progress) edge = i;
    else break;
  }
  return edge;
}
