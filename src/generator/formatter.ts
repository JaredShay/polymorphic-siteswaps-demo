import type { ApiBeat, HandThrow } from "../types";
import {
  type NotationElement,
  type BeatArray,
  type ThrowOrMultiplex,
  type Throw,
  isMultiplex,
  isSuppressed,
  isSyncLike,
  beatArrayToElements,
} from "./notation";
import {
  applyHalve,
  applyCancelPairs,
  applyExpand,
  applyPipeline,
} from "./transforms";
import type { Transform } from "./transforms";

// ── Pattern formatter: NotationElement[] → string ─────────────────────────────

function fmtSingle(t: Throw): string {
  const s = t.value.toString(36);
  return t.cross ? `${s}x` : s;
}

function fmtThrow(t: ThrowOrMultiplex): string {
  if (isMultiplex(t)) {
    const inner = [...t.throws]
      .sort((a, b) => a.value - b.value)
      .map(fmtSingle)
      .join("");
    return `[${inner}]`;
  }
  return fmtSingle(t);
}

function renderElement(el: NotationElement): string {
  switch (el.kind) {
    case "suppressed":
      return `(${fmtThrow(el.left)},${fmtThrow(el.right)})!`;
    case "sync":
      return `(${fmtThrow(el.left)},${fmtThrow(el.right)})`;
    case "async":
      return fmtSingle(el.throw);
    case "annotation":
      return el.hand === "right" ? "R" : "L";
    case "empty":
      return "0";
  }
}

export function formatPattern(elements: NotationElement[]): string {
  return elements.map(renderElement).join("");
}

// ── Beats formatter: NotationElement[] → ApiBeat[] ───────────────────────────

function handThrows(t: ThrowOrMultiplex): HandThrow[] {
  if (isMultiplex(t)) {
    return [...t.throws]
      .sort((a, b) => a.value - b.value)
      .map((th) => ({
        label: th.cross ? `${th.value.toString(36)}x` : th.value.toString(36),
        value: th.value,
        cross: th.cross,
      }));
  }
  if (t.value === 0) return [];
  return [
    {
      label: t.cross ? `${t.value.toString(36)}x` : t.value.toString(36),
      value: t.value,
      cross: t.cross,
    },
  ];
}

export function formatBeats(elements: NotationElement[]): ApiBeat[] {
  return elements.map((el, index) => {
    if (!isSyncLike(el)) {
      return { index, suppressed: false };
    }
    const suppressed = isSuppressed(el);
    const leftThrows = handThrows(el.left);
    const rightThrows = handThrows(el.right);
    const beat: ApiBeat = { index, suppressed };
    if (leftThrows.length > 0) beat.left = { throws: leftThrows };
    if (rightThrows.length > 0) beat.right = { throws: rightThrows };
    return beat;
  });
}

// ── Multi formatter: BeatArray → { halved, simplified, beats, multiplex } ─────

export type FormattedPattern = {
  halved: string;
  simplified: string;
  beats: ApiBeat[];
  multiplex: boolean;
  multiplex_slots: Array<{ beat: number; hand: string; throws: string[] }>;
};

export type PresetMap = {
  halved: Transform[];
  simplified: Transform[];
};

export const PRESETS: PresetMap = {
  halved: [applyHalve as Transform],
  simplified: [applyHalve as Transform, applyCancelPairs, applyExpand],
};

export function formatMulti(
  beatArray: BeatArray,
  presets: PresetMap,
): FormattedPattern {
  const raw = beatArrayToElements(beatArray);

  const halvedEls = applyPipeline(raw, presets.halved);
  const simplifiedEls = applyPipeline(raw, presets.simplified);

  const isMultiplexPattern = beatArray.some(
    ([l, r]) => isMultiplex(l) || isMultiplex(r),
  );

  const multiplexSlots: FormattedPattern["multiplex_slots"] = [];
  if (isMultiplexPattern) {
    beatArray.forEach(([l, r], beat) => {
      if (isMultiplex(l)) {
        multiplexSlots.push({
          beat,
          hand: "left",
          throws: [...l.throws]
            .sort((a, b) => a.value - b.value)
            .map(fmtSingle),
        });
      }
      if (isMultiplex(r)) {
        multiplexSlots.push({
          beat,
          hand: "right",
          throws: [...r.throws]
            .sort((a, b) => a.value - b.value)
            .map(fmtSingle),
        });
      }
    });
  }

  return {
    halved: formatPattern(halvedEls),
    simplified: formatPattern(simplifiedEls),
    beats: formatBeats(halvedEls),
    multiplex: isMultiplexPattern,
    multiplex_slots: multiplexSlots,
  };
}
