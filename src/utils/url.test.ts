import { describe, it, expect } from "vitest";
import {
  encodePbeats,
  decodePbeats,
  encodePr,
  decodePr,
  buildUrl,
  patternFromUrl,
} from "./url";
import type { Pattern, ApiBeat, Rhythm } from "../types";

const rhythm: Rhythm = { n: 6, leftBeats: [0, 3], rightBeats: [0, 2, 4] };

const mockBeats: ApiBeat[] = [
  {
    index: 0,
    suppressed: true,
    left: { throws: [{ label: "4x", value: 4, cross: true }] },
    right: { throws: [{ label: "6", value: 6, cross: false }] },
  },
  { index: 1, suppressed: true },
  {
    index: 2,
    suppressed: true,
    right: { throws: [{ label: "2", value: 2, cross: false }] },
  },
];

const mockPattern: Pattern = {
  id: "test-id",
  halved: "(4x,6)!(0,0)!(0,2)!",
  simplified: "R4x6R2",
  balls: 4,
  state: "ground",
  family: "3over2",
  cycles: 1,
  length: 3,
  rhythm,
  beats: mockBeats,
};

describe("encodePr / decodePr", () => {
  it("round-trips a rhythm", () => {
    expect(decodePr(encodePr(rhythm))).toEqual(rhythm);
  });

  it("encodes in expected format", () => {
    expect(encodePr(rhythm)).toBe("6:0,3:0,2,4");
  });
});

describe("encodePbeats / decodePbeats", () => {
  it("round-trips beats array (restoring index and label)", () => {
    const encoded = encodePbeats(mockBeats);
    const decoded = decodePbeats(encoded);
    expect(decoded).toHaveLength(mockBeats.length);
    expect(decoded[0].index).toBe(0);
    expect(decoded[0].suppressed).toBe(true);
    expect(decoded[0].left?.throws[0].label).toBe("4x");
    expect(decoded[0].left?.throws[0].value).toBe(4);
    expect(decoded[0].left?.throws[0].cross).toBe(true);
    expect(decoded[1].left).toBeUndefined();
    expect(decoded[1].right).toBeUndefined();
  });
});

describe("buildUrl / patternFromUrl", () => {
  it("round-trips a pattern through the URL", () => {
    const url = buildUrl(mockPattern, {
      balls: new Set(["4"]),
      family: new Set(["3over2"]),
      state: new Set(["ground", "active"]),
      cycles: new Set(["1"]),
    });
    const params = new URLSearchParams(url.split("?")[1]);
    const recovered = patternFromUrl(params);
    expect(recovered).not.toBeNull();
    expect(recovered!.halved).toBe(mockPattern.halved);
    expect(recovered!.simplified).toBe(mockPattern.simplified);
    expect(recovered!.balls).toBe(mockPattern.balls);
    expect(recovered!.family).toBe(mockPattern.family);
    expect(recovered!.rhythm).toEqual(rhythm);
    expect(recovered!.beats).toHaveLength(mockBeats.length);
  });

  it("returns null when required params are missing", () => {
    expect(patternFromUrl(new URLSearchParams())).toBeNull();
  });
});
