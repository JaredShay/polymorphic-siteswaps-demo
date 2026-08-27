import type { ApiBeat, BeatHand, Rhythm } from "../types";

// ── Output types (transform results — not stored, not passed across the app) ─

export type AnimatorThrow = {
  beat: number;
  side: "left" | "right";
  value: number;
  cross: boolean;
  label: string;
};

export type NotationBeat = {
  // "rest"  = off-rhythm beat with no throws (purely structural gap)
  // "zero"  = on-rhythm beat with no actual throw (valid siteswap zero)
  // "left"  = only left hand throws
  // "right" = only right hand throws
  // "sync"  = both hands throw
  kind: "rest" | "zero" | "left" | "right" | "sync";
  leftLabel?: string;   // "[34]" for multiplex, "6x" for single
  rightLabel?: string;
  suppressed: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function handLabel(hand: BeatHand): string {
  if (hand.throws.length === 1) return hand.throws[0].label;
  return `[${hand.throws.map(t => t.label).join("")}]`;
}

// ── Transforms ────────────────────────────────────────────────────────────────

// For the FingerprintCard animator — one entry per throw arc (multiplex expands to multiple).
export function toAnimatorThrows(beats: ApiBeat[]): AnimatorThrow[] {
  return beats.flatMap(b => [
    ...(b.left?.throws.map(t => ({ beat: b.index, side: "left" as const, ...t })) ?? []),
    ...(b.right?.throws.map(t => ({ beat: b.index, side: "right" as const, ...t })) ?? []),
  ]);
}

// For the NotationDisplay. The rhythm is required to distinguish:
//   - true rests (off-rhythm gaps, no throw) styled maximally dim
//   - zero throws (on-rhythm site, zero value) styled dim but visually present
export function toNotationBeats(beats: ApiBeat[], rhythm: Rhythm): NotationBeat[] {
  return beats.map(b => {
    const onLeft  = rhythm.leftBeats.includes(b.index);
    const onRight = rhythm.rightBeats.includes(b.index);
    const hasLeft  = !!b.left;
    const hasRight = !!b.right;

    const isOffRhythm = !onLeft && !onRight;
    const isZeroZero  = !hasLeft && !hasRight;

    const kind = (isOffRhythm && isZeroZero) ? "rest"
               : (isZeroZero)                 ? "zero"
               : (hasLeft && hasRight)         ? "sync"
               : hasLeft                       ? "left"
                                               : "right";

    return {
      kind,
      leftLabel:  b.left  ? handLabel(b.left)  : undefined,
      rightLabel: b.right ? handLabel(b.right) : undefined,
      suppressed: b.suppressed,
    };
  });
}

