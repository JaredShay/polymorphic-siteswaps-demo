import type { Pattern, FilterState, Rhythm, ApiBeat } from "../types";

// ── Rhythm encoding ───────────────────────────────────────────────────────────

export function encodePr(rhythm: Rhythm): string {
  return `${rhythm.n}:${rhythm.leftBeats.join(",")}:${rhythm.rightBeats.join(",")}`;
}

export function decodePr(encoded: string): Rhythm {
  const [nStr, leftStr, rightStr] = encoded.split(":");
  return {
    n: parseInt(nStr),
    leftBeats: leftStr.split(",").map(Number),
    rightBeats: rightStr.split(",").map(Number),
  };
}

// ── Beats encoding ────────────────────────────────────────────────────────────
// Store ApiBeat[] without derived fields: index (implicit) and label (derived).

type MinimalThrow = { value: number; cross: boolean };
type MinimalBeatHand = { throws: MinimalThrow[] };
type MinimalApiBeat = {
  suppressed: boolean;
  left?: MinimalBeatHand;
  right?: MinimalBeatHand;
};

export function encodePbeats(beats: ApiBeat[]): string {
  const minimal: MinimalApiBeat[] = beats.map(({ suppressed, left, right }) => {
    const b: MinimalApiBeat = { suppressed };
    if (left) {
      b.left = {
        throws: left.throws.map(({ value, cross }) => ({ value, cross })),
      };
    }
    if (right) {
      b.right = {
        throws: right.throws.map(({ value, cross }) => ({ value, cross })),
      };
    }
    return b;
  });
  return btoa(JSON.stringify(minimal));
}

function rehydrateThrow(t: MinimalThrow) {
  return {
    label: t.value.toString(36) + (t.cross ? "x" : ""),
    value: t.value,
    cross: t.cross,
  };
}

export function decodePbeats(encoded: string): ApiBeat[] {
  const minimal: MinimalApiBeat[] = JSON.parse(atob(encoded));
  return minimal.map((b, index) => {
    const beat: ApiBeat = { index, suppressed: b.suppressed };
    if (b.left) beat.left = { throws: b.left.throws.map(rehydrateThrow) };
    if (b.right) beat.right = { throws: b.right.throws.map(rehydrateThrow) };
    return beat;
  });
}

// ── Pattern ↔ URL ─────────────────────────────────────────────────────────────

function computeId(
  family: string,
  balls: number,
  state: string,
  cycles: number,
  halved: string,
): string {
  return `${family}-${balls}b-${state}-${cycles}c-${halved.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`;
}

export function patternFromUrl(p: URLSearchParams): Pattern | null {
  const ph = p.get("ph");
  const psimp = p.get("psimp");
  const pbeats = p.get("pbeats");
  const pr = p.get("pr");
  const pf = p.get("pf");
  const ps = p.get("ps");
  const pb = p.get("pb");
  const pc = p.get("pc");

  if (!ph || !psimp || !pbeats || !pr || !pf || !ps || !pb || !pc) return null;

  try {
    const beats = decodePbeats(pbeats);
    const rhythm = decodePr(pr);
    const balls = parseInt(pb);
    const cycles = parseInt(pc);

    return {
      id: computeId(pf, balls, ps, cycles, ph),
      halved: ph,
      simplified: psimp,
      balls,
      state: ps,
      family: pf,
      cycles,
      length: beats.length,
      rhythm,
      beats,
    };
  } catch {
    return null;
  }
}

export function buildUrl(pattern: Pattern, filters: FilterState): string {
  const params = new URLSearchParams({
    ph: pattern.halved,
    psimp: pattern.simplified,
    pr: encodePr(pattern.rhythm),
    pbeats: encodePbeats(pattern.beats),
    pb: String(pattern.balls),
    pf: pattern.family,
    ps: pattern.state,
    pc: String(pattern.cycles),
    fb: Array.from(filters.balls).sort().join(","),
    ff: Array.from(filters.family).sort().join(","),
    fs: Array.from(filters.state).sort().join(","),
    fc: Array.from(filters.cycles).sort().join(","),
  });

  const qs = params
    .toString()
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2C/g, ",")
    .replace(/%21/g, "!");

  return `${location.origin}${location.pathname}?${qs}`;
}
