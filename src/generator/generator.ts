import {
  type BeatArray,
  type ThrowOrMultiplex,
  type Throw,
  isThrow,
  isMultiplex,
  mkThrow,
  mkMultiplex,
  throwValue,
} from "./notation";
import { formatMulti, PRESETS } from "./formatter";
import { defaultThrows } from "./throws";
import type { Pattern, GeneratorParams, Rhythm } from "../types";

// ── Internal types ────────────────────────────────────────────────────────────

type Slot = readonly [number, number]; // [beat, hand] — hand: 0=left, 1=right
type Holes = number[][]; // holes[beat][hand] = occupancy
type Provenance = Array<
  Array<Array<{ sourceBeat: number; sourceHand: number }>>
>;

type GeneratorContext = {
  period: number;
  leftBeats: number[];
  rightBeats: number[];
  balls: number;
  throws: number[];
  groundLimit: number;
  activeLimit: number;
  groundResults: BeatArray[];
  activeResults: BeatArray[];
  seen: Set<string>;
  groundState: Array<[number, number]>;
  slots: Slot[];
  initialHoles: Holes;
  abortRef: { aborted: boolean };
  mode: "ordered" | "sampled";
  foundOne: boolean; // sampled mode: stop traversal after first valid candidate
  family: string;
  cycles: number;
};

// ── Ground state computation ──────────────────────────────────────────────────

function computeGroundState(
  period: number,
  leftBeats: number[],
  rightBeats: number[],
  balls: number,
): Array<[number, number]> {
  // slots sorted by [beat, hand]
  const slots: Array<[number, number]> = [
    ...leftBeats.map((b): [number, number] => [b, 0]),
    ...rightBeats.map((b): [number, number] => [b, 1]),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const result: Array<[number, number]> = [];
  let cycle = 0;
  while (result.length < balls) {
    for (const [b, h] of slots) {
      result.push([b + cycle * period, h]);
      if (result.length === balls) break;
    }
    cycle++;
  }
  return result;
}

// ── Throw slots ───────────────────────────────────────────────────────────────

function strictThrowSlots(
  period: number,
  leftBeats: number[],
  rightBeats: number[],
): Slot[] {
  const slots: Slot[] = [];
  for (let b = 0; b < period; b++) {
    if (leftBeats.includes(b)) slots.push([b, 0]);
    if (rightBeats.includes(b)) slots.push([b, 1]);
  }
  return slots;
}

// ── Holes initialisation ──────────────────────────────────────────────────────

function initHoles(period: number, slots: Slot[], occupancy: number[]): Holes {
  const h: Holes = Array.from({ length: period }, () => [0, 0]);
  slots.forEach(([beat, hand], k) => {
    h[beat][hand] = occupancy[k];
  });
  return h;
}

function cloneHoles(h: Holes): Holes {
  return h.map((row) => [...row]);
}

// ── Target and max throw ──────────────────────────────────────────────────────

function target(balls: number, period: number): number {
  return balls * period * 2;
}

function maxPossibleThrow(throws: number[]): number {
  return throws.length > 0 ? Math.max(...throws) : 0;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function fmtThrowKey(t: ThrowOrMultiplex): string {
  if (isMultiplex(t)) {
    const inner = [...t.throws]
      .sort((a, b) => a.value - b.value)
      .map((th) => th.value.toString(36) + (th.cross ? "x" : ""))
      .join("");
    return `[${inner}]`;
  }
  return t.value.toString(36) + (t.cross ? "x" : "");
}

function syncUnparse(beatArray: BeatArray): string {
  return beatArray
    .map(([l, r]) => `(${fmtThrowKey(l)},${fmtThrowKey(r)})`)
    .join("");
}

function mirrorBeats(beatArray: BeatArray): BeatArray {
  return beatArray.map(([l, r]) => [r, l] as const);
}

function rotationStartCandidates(
  beatArray: BeatArray,
  period: number,
): number[] {
  const both = Array.from({ length: period }, (_, r) => r).filter(
    (r) =>
      throwValue(beatArray[r][0]) !== 0 && throwValue(beatArray[r][1]) !== 0,
  );
  if (both.length > 0) return both;
  return Array.from({ length: period }, (_, r) => r).filter(
    (r) =>
      throwValue(beatArray[r][0]) !== 0 || throwValue(beatArray[r][1]) !== 0,
  );
}

function canonicalRotation(beatArray: BeatArray, period: number): BeatArray {
  const starts = rotationStartCandidates(beatArray, period);
  let best: BeatArray = beatArray;
  let bestKey = syncUnparse(beatArray);
  for (const s of starts) {
    const rotated = [
      ...beatArray.slice(s),
      ...beatArray.slice(0, s),
    ] as BeatArray;
    const key = syncUnparse(rotated);
    if (key < bestKey) {
      best = rotated;
      bestKey = key;
    }
  }
  return best;
}

// ── State classification ──────────────────────────────────────────────────────

function beatState(
  beatArray: BeatArray,
  period: number,
): Array<[number, number]> {
  const state: Array<[number, number]> = [];
  beatArray.forEach(([l, r], i) => {
    for (const [throwHand, t] of [
      [0, l],
      [1, r],
    ] as [number, ThrowOrMultiplex][]) {
      const throws: Throw[] = isMultiplex(t)
        ? [...t.throws]
        : isThrow(t) && t.value > 0
          ? [t]
          : [];
      for (const th of throws) {
        const landHand = throwHand ^ (th.cross ? 1 : 0);
        const rel = i + Math.floor(th.value / 2) - period;
        if (rel >= 0) state.push([rel, landHand]);
      }
    }
  });
  return state.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function statesEqual(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x[0] === b[i][0] && x[1] === b[i][1]);
}

// ── Cross-check for required crossing ────────────────────────────────────────

function hasCross(beatArray: BeatArray): boolean {
  return beatArray.some(([l, r]) => {
    const checkThrow = (t: ThrowOrMultiplex): boolean =>
      isMultiplex(t) ? t.throws.some((th) => th.cross) : isThrow(t) && t.cross;
    return checkThrow(l) || checkThrow(r);
  });
}

// ── Provenance (squeeze catch detection) ─────────────────────────────────────

function initProvenance(period: number): Provenance {
  return Array.from({ length: period }, () => [[], []]);
}

function squeezeFromExternal(
  prov: Provenance,
  initialHoles: Holes,
  lb: number,
  lh: number,
): boolean {
  if (initialHoles[lb][lh] > 1) return false;
  return prov[lb][lh].length > 0;
}

// ── Build beat array ──────────────────────────────────────────────────────────

function buildBeatArray(
  slots: Slot[],
  chosen: Array<Throw | Throw[]>,
  occupancy: number[],
  period: number,
): BeatArray {
  const arr: [ThrowOrMultiplex, ThrowOrMultiplex][] = Array.from(
    { length: period },
    () => [mkThrow(0, false), mkThrow(0, false)],
  );
  slots.forEach(([beat, hand], k) => {
    const c = chosen[k];
    if (occupancy[k] > 1 && Array.isArray(c)) {
      arr[beat][hand] = mkMultiplex(c as Throw[]);
    } else {
      arr[beat][hand] = c as Throw;
    }
  });
  return arr as BeatArray;
}

// ── Add result ────────────────────────────────────────────────────────────────
//
// limit = 0 means "skip this category entirely"
// limit > 0 means "collect up to N patterns"

function addResult(
  ctx: GeneratorContext,
  beatArray: BeatArray,
  onPattern: (p: Pattern) => void,
): void {
  if (!hasCross(beatArray)) return;

  // Sampled mode: this walk found a valid candidate — stop traversal after this.
  ctx.foundOne = true;

  const canonical = canonicalRotation(beatArray, ctx.period);
  const key = syncUnparse(canonical);
  if (ctx.seen.has(key)) return;
  ctx.seen.add(key);

  const mirrorKey = syncUnparse(
    canonicalRotation(mirrorBeats(canonical), ctx.period),
  );
  if (mirrorKey !== key) ctx.seen.add(mirrorKey);

  const state = beatState(canonical, ctx.period);
  const isGround = statesEqual(state, ctx.groundState);

  // limit = 0 means skip this category; limit > 0 means collect up to N
  if (
    isGround &&
    (ctx.groundLimit === 0 || ctx.groundResults.length >= ctx.groundLimit)
  )
    return;
  if (
    !isGround &&
    (ctx.activeLimit === 0 || ctx.activeResults.length >= ctx.activeLimit)
  )
    return;

  const formatted = formatMulti(canonical, PRESETS);
  const pattern: Pattern = {
    id: `${ctx.family}-${ctx.balls}b-${isGround ? "ground" : "active"}-${ctx.cycles}c-${formatted.halved.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`,
    halved: formatted.halved,
    simplified: formatted.simplified,
    balls: ctx.balls,
    state: isGround ? "ground" : "active",
    family: ctx.family,
    cycles: ctx.cycles,
    length: formatted.beats.length,
    rhythm: {
      n: ctx.period,
      leftBeats: ctx.leftBeats,
      rightBeats: ctx.rightBeats,
    },
    beats: formatted.beats,
  };

  if (isGround) {
    ctx.groundResults.push(canonical);
  } else {
    ctx.activeResults.push(canonical);
  }
  onPattern(pattern);
}

// ── DFS fill slot ──────────────────────────────────────────────────────────────

function fillSlot(
  ctx: GeneratorContext,
  k: number,
  holes: Holes,
  chosen: Array<Throw | Throw[]>,
  sum: number,
  occupancy: number[],
  prov: Provenance,
  tgt: number,
  maxThrow: number,
  onPattern: (p: Pattern) => void,
): void {
  if (ctx.abortRef.aborted) return;
  if (ctx.mode === "sampled" && ctx.foundOne) return;

  // Stop early when all wanted categories are satisfied.
  // limit = 0 means "skip" (already satisfied); limit > 0 means "want N".
  const groundDone =
    ctx.groundLimit === 0 || ctx.groundResults.length >= ctx.groundLimit;
  const activeDone =
    ctx.activeLimit === 0 || ctx.activeResults.length >= ctx.activeLimit;
  const isLimited = ctx.groundLimit > 0 || ctx.activeLimit > 0;
  if (isLimited && groundDone && activeDone) return;

  if (k === ctx.slots.length) {
    if (sum === tgt) {
      addResult(
        ctx,
        buildBeatArray(ctx.slots, chosen, occupancy, ctx.period),
        onPattern,
      );
    }
    return;
  }

  const [beat, hand] = ctx.slots[k];
  const remainingCt = ctx.slots.length - k - 1;

  // Sampled mode: shuffle at every node for independent random walks
  const shuffled = ctx.mode === "sampled";
  const throwOrder = shuffled
    ? [...ctx.throws].sort(() => Math.random() - 0.5)
    : ctx.throws;
  const crossOrder: boolean[] = shuffled
    ? [false, true].sort(() => Math.random() - 0.5)
    : [false, true];

  for (const v of throwOrder) {
    if (v === 0) continue;
    for (const cross of crossOrder) {
      const lh = cross ? hand ^ 1 : hand;
      const lb = (beat + Math.floor(v / 2)) % ctx.period;
      if (holes[lb][lh] === 0) continue;

      const newSum = sum + v;
      if (newSum > tgt) continue;
      if (newSum + remainingCt * maxThrow < tgt) continue;
      if (squeezeFromExternal(prov, ctx.initialHoles, lb, lh)) continue;

      holes[lb][lh]--;
      prov[lb][lh].push({ sourceBeat: beat, sourceHand: hand });
      chosen[k] = mkThrow(v, cross);

      fillSlot(
        ctx,
        k + 1,
        holes,
        chosen,
        newSum,
        occupancy,
        prov,
        tgt,
        maxThrow,
        onPattern,
      );

      prov[lb][lh].pop();
      holes[lb][lh]++;
    }
  }
}

// ── Multi-cycle rhythm expansion ──────────────────────────────────────────────

function expandRhythm(
  rhythm: Rhythm,
  cycles: number,
): { period: number; leftBeats: number[]; rightBeats: number[] } {
  if (cycles === 1) {
    return {
      period: rhythm.n,
      leftBeats: [...rhythm.leftBeats],
      rightBeats: [...rhythm.rightBeats],
    };
  }
  const period = rhythm.n;
  const leftBeats: number[] = [];
  const rightBeats: number[] = [];
  for (let c = 0; c < cycles; c++) {
    rhythm.leftBeats.forEach((b) => leftBeats.push(b + c * period));
    rhythm.rightBeats.forEach((b) => rightBeats.push(b + c * period));
  }
  return { period: period * cycles, leftBeats, rightBeats };
}

// ── Public entry point ────────────────────────────────────────────────────────

export function runGenerator(
  params: GeneratorParams,
  onPattern: (p: Pattern) => void,
  abortRef: { aborted: boolean },
): void {
  const { rhythm, balls, cycles, groundLimit, activeLimit, mode, family } =
    params;
  const { period, leftBeats, rightBeats } = expandRhythm(rhythm, cycles);
  const throws = defaultThrows(balls, rhythm, cycles);
  const tgt = target(balls, period);
  const maxThrow = maxPossibleThrow(throws);
  const slots = strictThrowSlots(period, leftBeats, rightBeats);
  const occupancy = Array(slots.length).fill(1);
  const holes = initHoles(period, slots, occupancy);
  const initialHoles = cloneHoles(holes);
  const groundState = computeGroundState(period, leftBeats, rightBeats, balls);

  const ctx: GeneratorContext = {
    period,
    leftBeats,
    rightBeats,
    balls,
    throws,
    groundLimit,
    activeLimit,
    groundResults: [],
    activeResults: [],
    seen: new Set(),
    groundState,
    slots,
    initialHoles,
    abortRef,
    mode,
    foundOne: false,
    family,
    cycles,
  };

  if (mode === "sampled") {
    // Independent random walk per pattern: restart from scratch after each find.
    // Stop when limits are met or 100 consecutive walks yield no new pattern.
    let consecutiveFails = 0;
    const maxConsecutiveFails = 100;
    while (!abortRef.aborted && consecutiveFails < maxConsecutiveFails) {
      const groundDone =
        groundLimit === 0 || ctx.groundResults.length >= groundLimit;
      const activeDone =
        activeLimit === 0 || ctx.activeResults.length >= activeLimit;
      if (groundDone && activeDone) break;
      const prevCount = ctx.groundResults.length + ctx.activeResults.length;
      ctx.foundOne = false;
      const freshHoles = cloneHoles(ctx.initialHoles);
      const freshChosen: Array<Throw | Throw[]> = Array(slots.length);
      const freshProv = initProvenance(period);
      fillSlot(
        ctx,
        0,
        freshHoles,
        freshChosen,
        0,
        occupancy,
        freshProv,
        tgt,
        maxThrow,
        onPattern,
      );
      const newCount = ctx.groundResults.length + ctx.activeResults.length;
      if (newCount > prevCount) {
        consecutiveFails = 0;
      } else {
        consecutiveFails++;
      }
    }
  } else {
    // Ordered: single DFS in sorted throw order — deterministic, reproducible.
    const chosen: Array<Throw | Throw[]> = Array(slots.length);
    const prov = initProvenance(period);
    fillSlot(
      ctx,
      0,
      holes,
      chosen,
      0,
      occupancy,
      prov,
      tgt,
      maxThrow,
      onPattern,
    );
  }
}
