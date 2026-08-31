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
