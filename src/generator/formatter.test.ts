import { describe, it, expect } from "vitest";
import { formatPattern, formatBeats, PRESETS, formatMulti } from "./formatter";
import {
  mkThrow,
  mkSuppressed,
  mkSync,
  mkAsync,
  EMPTY_SLOT,
  mkAnnotation,
  mkMultiplex,
} from "./notation";
import type { NotationElement, BeatArray } from "./notation";

describe("formatPattern", () => {
  it("formats a suppressed sync beat", () => {
    const elements: NotationElement[] = [
      mkSuppressed(mkThrow(4, true), mkThrow(6, false)),
    ];
    expect(formatPattern(elements)).toBe("(4x,6)!");
  });

  it("formats a sync beat (no suppression)", () => {
    const elements: NotationElement[] = [
      mkSync(mkThrow(4, false), mkThrow(6, false)),
    ];
    expect(formatPattern(elements)).toBe("(4,6)");
  });

  it("formats an async throw", () => {
    expect(formatPattern([mkAsync(mkThrow(3, false))])).toBe("3");
    expect(formatPattern([mkAsync(mkThrow(3, true))])).toBe("3x");
  });

  it("formats a hand annotation", () => {
    expect(formatPattern([mkAnnotation("right")])).toBe("R");
    expect(formatPattern([mkAnnotation("left")])).toBe("L");
  });

  it("formats an empty slot", () => {
    expect(formatPattern([EMPTY_SLOT])).toBe("0");
  });

  it("formats values > 9 using base-36", () => {
    expect(formatPattern([mkAsync(mkThrow(10, false))])).toBe("a");
    expect(formatPattern([mkAsync(mkThrow(11, false))])).toBe("b");
  });

  it("formats a multiplex throw inside a sync beat", () => {
    const mp = mkMultiplex([mkThrow(4, false), mkThrow(6, true)]);
    const el: NotationElement = mkSuppressed(mp, mkThrow(0, false));
    expect(formatPattern([el])).toBe("([46x],0)!");
  });
});

describe("formatBeats", () => {
  it("produces an ApiBeat for each element", () => {
    const elements: NotationElement[] = [
      mkSuppressed(mkThrow(4, true), mkThrow(6, false)),
      mkSuppressed(mkThrow(0, false), mkThrow(0, false)),
    ];
    const result = formatBeats(elements);
    expect(result).toHaveLength(2);
    expect(result[0].index).toBe(0);
    expect(result[0].suppressed).toBe(true);
    expect(result[0].left?.throws[0]).toEqual({
      label: "4x",
      value: 4,
      cross: true,
    });
    expect(result[0].right?.throws[0]).toEqual({
      label: "6",
      value: 6,
      cross: false,
    });
  });

  it("omits left/right when the hand is silent", () => {
    const elements: NotationElement[] = [
      mkSuppressed(mkThrow(0, false), mkThrow(6, false)),
    ];
    const result = formatBeats(elements);
    expect(result[0].left).toBeUndefined();
    expect(result[0].right).toBeDefined();
  });
});

describe("formatMulti", () => {
  it("returns halved and simplified strings for a simple beat array", () => {
    // 3/2 ground state pattern: period=6
    const beatArray: BeatArray = [
      [mkThrow(8, false), mkThrow(6, true)], // beat 0: both hands
      [mkThrow(0, false), mkThrow(0, false)], // beat 1: silent
      [mkThrow(0, false), mkThrow(4, false)], // beat 2: right only
      [mkThrow(8, false), mkThrow(0, false)], // beat 3: left only
      [mkThrow(0, false), mkThrow(4, false)], // beat 4: right only
      [mkThrow(0, false), mkThrow(0, false)], // beat 5: silent
    ];
    const result = formatMulti(beatArray, PRESETS);
    expect(typeof result.halved).toBe("string");
    expect(typeof result.simplified).toBe("string");
    expect(Array.isArray(result.beats)).toBe(true);
    expect(result.multiplex).toBe(false);
  });
});
