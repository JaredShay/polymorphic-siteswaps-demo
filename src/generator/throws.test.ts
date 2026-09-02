import { describe, it, expect } from "vitest";
import { defaultThrows } from "./throws";
import type { Rhythm } from "../types";

const RHYTHM_3_2: Rhythm = { n: 6, leftBeats: [0, 3], rightBeats: [0, 2, 4] };
const RHYTHM_4_3: Rhythm = {
  n: 12,
  leftBeats: [0, 4, 8],
  rightBeats: [0, 3, 6, 9],
};
const RHYTHM_5_4: Rhythm = {
  n: 20,
  leftBeats: [0, 5, 10, 15],
  rightBeats: [0, 4, 8, 12, 16],
};

describe("defaultThrows", () => {
  it("returns only even integers", () => {
    const throws = defaultThrows(4, RHYTHM_3_2, 1);
    expect(throws.every((v) => v % 2 === 0)).toBe(true);
  });

  it("always includes 0", () => {
    expect(defaultThrows(4, RHYTHM_3_2, 1)[0]).toBe(0);
    expect(defaultThrows(5, RHYTHM_4_3, 1)[0]).toBe(0);
  });

  it("returns a non-empty set for all supported rhythms and ball counts", () => {
    const rhythms: Rhythm[] = [
      RHYTHM_3_2,
      RHYTHM_4_3,
      { n: 10, leftBeats: [0, 5], rightBeats: [0, 2, 4, 6, 8] },
      { n: 15, leftBeats: [0, 5, 10], rightBeats: [0, 3, 6, 9, 12] },
      RHYTHM_5_4,
      { n: 8, leftBeats: [0, 4], rightBeats: [0, 3, 6] },
      { n: 16, leftBeats: [0, 4, 8, 12], rightBeats: [0, 3, 6, 10, 12] },
    ];
    for (const r of rhythms) {
      for (const balls of [4, 5]) {
        const t = defaultThrows(balls, r, 1);
        expect(
          t.length,
          `empty throws for balls=${balls} n=${r.n}`,
        ).toBeGreaterThan(1);
      }
    }
  });

  it("scales with cycle count", () => {
    const t1 = defaultThrows(4, RHYTHM_3_2, 1);
    const t2 = defaultThrows(4, RHYTHM_3_2, 2);
    expect(t2[t2.length - 1]).toBeGreaterThanOrEqual(t1[t1.length - 1]);
  });

  it("returns values in ascending order", () => {
    const throws = defaultThrows(5, RHYTHM_4_3, 1);
    for (let i = 1; i < throws.length; i++) {
      expect(throws[i]).toBeGreaterThan(throws[i - 1]);
    }
  });
});
