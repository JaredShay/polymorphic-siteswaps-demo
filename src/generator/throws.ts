import type { Rhythm } from "../types";

/**
 * Derive a throw set from rhythm and ball count.
 *
 * The target sum for the generator is balls * period * 2 (doubled notation).
 * We cap throws at 2× the average throw per slot, rounded up to the next even
 * number. This covers the interesting pattern space without making the DFS
 * intractably large.
 *
 * This function is also used as the suggested default when a throw-set UI
 * input is added in a future iteration.
 */
export function defaultThrows(
  balls: number,
  rhythm: Rhythm,
  cycles: number,
): number[] {
  const period = rhythm.n * cycles;
  const numSlots =
    (rhythm.leftBeats.length + rhythm.rightBeats.length) * cycles;
  const target = balls * period * 2;
  const avg = target / numSlots;
  // Round up to next even number
  const maxThrow = Math.ceil((avg * 2) / 2) * 2;

  const result: number[] = [];
  for (let v = 0; v <= maxThrow; v += 2) {
    result.push(v);
  }
  return result;
}
