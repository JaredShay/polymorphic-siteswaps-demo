import { describe, it, expect } from "vitest";
import { generatePatterns } from "./index";
import type { Pattern } from "../types";
import { RHYTHM_PRESETS } from "../data/rhythmPresets";

const rhythm3over2 = RHYTHM_PRESETS.find((r) => r.id === "3over2")!.rhythm;

function collect(
  balls: number,
  groundLimit: number,
  activeLimit: number,
  cycles = 1,
  mode: "ordered" | "sampled" = "ordered",
): Pattern[] {
  const results: Pattern[] = [];
  const abortRef = { aborted: false };
  generatePatterns(
    {
      rhythm: rhythm3over2,
      balls,
      cycles,
      groundLimit,
      activeLimit,
      mode,
      family: "3over2",
    },
    (p) => results.push(p),
    abortRef,
  );
  return results;
}

describe("generatePatterns — 3/2 rhythm", () => {
  it("finds at least one ground pattern for 4 balls", () => {
    const results = collect(4, 5, 0);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.state === "ground")).toBe(true);
  });

  it("finds at least one ground pattern for 5 balls", () => {
    const results = collect(5, 5, 0);
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects groundLimit and activeLimit", () => {
    const results = collect(4, 2, 2);
    const ground = results.filter((p) => p.state === "ground");
    const active = results.filter((p) => p.state === "active");
    expect(ground.length).toBeLessThanOrEqual(2);
    expect(active.length).toBeLessThanOrEqual(2);
  });

  it("never returns duplicate patterns (same halved string + state)", () => {
    const results = collect(4, 50, 50);
    const keys = results.map((p) => `${p.state}:${p.halved}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(results.length);
  });

  it("stops early when abortRef.aborted is set", () => {
    const results: Pattern[] = [];
    const abortRef = { aborted: false };
    let count = 0;
    generatePatterns(
      {
        rhythm: rhythm3over2,
        balls: 4,
        cycles: 1,
        groundLimit: 100,
        activeLimit: 100,
        mode: "ordered",
        family: "3over2",
      },
      (p) => {
        results.push(p);
        count++;
        if (count >= 3) abortRef.aborted = true;
      },
      abortRef,
    );
    expect(results.length).toBeLessThan(10);
  });

  it("each pattern has a beats array with correct length", () => {
    const results = collect(4, 3, 0);
    for (const p of results) {
      // After HALVE, period stays the same (6 beats for 3/2)
      expect(p.beats.length).toBe(rhythm3over2.n);
    }
  });

  it("each pattern has halved and simplified strings", () => {
    const results = collect(4, 3, 0);
    for (const p of results) {
      expect(typeof p.halved).toBe("string");
      expect(p.halved.length).toBeGreaterThan(0);
      expect(typeof p.simplified).toBe("string");
    }
  });

  it("sampled mode finds patterns and respects limits", () => {
    const results = collect(4, 3, 3, 1, "sampled");
    const ground = results.filter((p) => p.state === "ground");
    const active = results.filter((p) => p.state === "active");
    expect(ground.length).toBeLessThanOrEqual(3);
    expect(active.length).toBeLessThanOrEqual(3);
    expect(results.length).toBeGreaterThan(0);
  });

  it("sampled mode never returns duplicates", () => {
    const results = collect(4, 10, 10, 1, "sampled");
    const keys = results.map((p) => `${p.state}:${p.halved}`);
    expect(new Set(keys).size).toBe(results.length);
  });

  it("sampled mode produces different orderings across runs (probabilistic)", () => {
    const run1 = collect(4, 5, 5, 1, "sampled");
    const run2 = collect(4, 5, 5, 1, "sampled");
    const seq1 = run1.map((p) => p.halved).join("|");
    const seq2 = run2.map((p) => p.halved).join("|");
    expect(seq1).not.toBe(seq2);
  });
});
