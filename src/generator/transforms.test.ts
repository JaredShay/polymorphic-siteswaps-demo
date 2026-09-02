import { describe, it, expect } from "vitest";
import { applyHalve, applyCancelPairs, applyExpand } from "./transforms";
import {
  mkThrow,
  mkSuppressed,
  mkSync,
  mkAsync,
  EMPTY_SLOT,
  mkAnnotation,
} from "./notation";
import type { SuppressedSyncBeat, NotationElement } from "./notation";

// Helper: build a SuppressedSyncBeat array for tests
function ssb(lv: number, lx: boolean, rv: number, rx: boolean): SuppressedSyncBeat {
  return mkSuppressed(mkThrow(lv, lx), mkThrow(rv, rx));
}

describe("applyHalve", () => {
  it("halves all throw values", () => {
    const input = [ssb(8, false, 4, false)];
    const result = applyHalve(input);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("suppressed");
    const b = result[0] as SuppressedSyncBeat;
    expect(b.left).toEqual({ value: 4, cross: false });
    expect(b.right).toEqual({ value: 2, cross: false });
  });

  it("keeps cross unchanged when v%4===0", () => {
    // value=8 (8%4=0): cross unchanged
    const input = [ssb(8, true, 4, true)];
    const result = applyHalve(input);
    const b = result[0] as SuppressedSyncBeat;
    expect(b.left).toEqual({ value: 4, cross: true });
    expect(b.right).toEqual({ value: 2, cross: true });
  });

  it("toggles cross when v%4===2", () => {
    // value=6 (6%4=2): toggle cross; value=2 (2%4=2): toggle cross
    const input = [ssb(6, false, 2, true)];
    const result = applyHalve(input);
    const b = result[0] as SuppressedSyncBeat;
    expect(b.left).toEqual({ value: 3, cross: true });
    expect(b.right).toEqual({ value: 1, cross: false });
  });

  it("preserves zero throws", () => {
    const input = [ssb(0, false, 0, false)];
    const result = applyHalve(input);
    const b = result[0] as SuppressedSyncBeat;
    expect(b.left).toEqual({ value: 0, cross: false });
    expect(b.right).toEqual({ value: 0, cross: false });
  });
});

describe("applyCancelPairs", () => {
  it("converts suppressed-beat + empty-suppressed-beat into a sync beat", () => {
    const input: SuppressedSyncBeat[] = [
      ssb(4, false, 6, false),
      ssb(0, false, 0, false),
    ];
    const result = applyCancelPairs(input);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("sync");
  });

  it("leaves non-empty pairs unchanged", () => {
    const input: SuppressedSyncBeat[] = [
      ssb(4, false, 6, false),
      ssb(2, false, 3, false),
    ];
    const result = applyCancelPairs(input);
    expect(result).toHaveLength(2);
    expect(result.every((b) => b.kind === "suppressed")).toBe(true);
  });

  it("handles odd-length arrays (last beat kept as-is)", () => {
    const input: SuppressedSyncBeat[] = [ssb(4, false, 6, false)];
    const result = applyCancelPairs(input);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("suppressed");
  });
});

describe("applyExpand", () => {
  it("expands suppressed empty beat to a single EmptySlot", () => {
    const input: NotationElement[] = [mkSuppressed(mkThrow(0, false), mkThrow(0, false))];
    const result = applyExpand(input);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("empty");
  });

  it("expands suppressed single-hand right beat to [annotation, async]", () => {
    const input: NotationElement[] = [mkSuppressed(mkThrow(0, false), mkThrow(4, false))];
    const result = applyExpand(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(mkAnnotation("right"));
    expect(result[1]).toEqual(mkAsync(mkThrow(4, false)));
  });

  it("expands suppressed single-hand left beat to [annotation, async]", () => {
    const input: NotationElement[] = [mkSuppressed(mkThrow(4, false), mkThrow(0, false))];
    const result = applyExpand(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(mkAnnotation("left"));
    expect(result[1]).toEqual(mkAsync(mkThrow(4, false)));
  });

  it("leaves two-hand beats and multiplex beats unchanged", () => {
    const input: NotationElement[] = [mkSync(mkThrow(4, false), mkThrow(6, false))];
    const result = applyExpand(input);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("sync");
  });

  it("removes redundant hand annotations that match alternation", () => {
    // Two consecutive single-hand expansions: R then L — second annotation (L) should be dropped
    const input: NotationElement[] = [
      mkSuppressed(mkThrow(0, false), mkThrow(4, false)), // R
      mkSuppressed(mkThrow(4, false), mkThrow(0, false)), // L
    ];
    const result = applyExpand(input);
    // Expect: [R, async(4), async(4)] — L annotation dropped as redundant
    expect(result[0]).toEqual(mkAnnotation("right"));
    expect(result[1].kind).toBe("async");
    expect(result[2].kind).toBe("async");
    expect(result).toHaveLength(3);
  });
});
