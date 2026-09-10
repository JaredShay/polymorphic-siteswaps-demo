import {
  type NotationElement,
  type SuppressedSyncBeat,
  type ThrowOrMultiplex,
  type Throw,
  type MultiplexThrow,
  isThrow,
  isMultiplex,
  isSuppressed,
  isSyncLike,
  mkThrow,
  mkSuppressed,
  mkAsync,
  EMPTY_SLOT,
  mkAnnotation,
  cancelSuppressed,
  syncIsEmpty,
  syncIsSingleHand,
  syncActiveThrow,
} from "./notation";

// ── Halve ──────────────────────────────────────────────────────────────────────
//
// Divide every throw value by 2, mark all beats suppressed.
// v%4 === 2 → parity flips → toggle cross to compensate.
// v%4 === 0 → parity unchanged → keep cross.
// Applied to each component independently for MultiplexThrow.

function halveSingle(t: Throw): Throw {
  const v = Math.floor(t.value / 2);
  const cross = t.value % 4 === 2 ? !t.cross : t.cross;
  return mkThrow(v, cross);
}

function halveThrow(t: ThrowOrMultiplex): ThrowOrMultiplex {
  if (isMultiplex(t)) {
    const halved = [...t.throws]
      .map(halveSingle)
      .sort((a, b) => a.value - b.value);
    return { throws: halved } as MultiplexThrow;
  }
  return halveSingle(t);
}

export function applyHalve(
  elements: SuppressedSyncBeat[],
): SuppressedSyncBeat[] {
  return elements.map((b) =>
    mkSuppressed(halveThrow(b.left), halveThrow(b.right)),
  );
}

// ── CancelPairs ────────────────────────────────────────────────────────────────
//
// X!(0,0)! → X  (un-suppressed).
// Scan left-to-right: if beat B is suppressed and beat B+1 is suppressed-empty,
// collapse into one SyncBeat and skip B+1.

export function applyCancelPairs(
  elements: NotationElement[],
): NotationElement[] {
  const result: NotationElement[] = [];
  let i = 0;
  while (i < elements.length) {
    const b = elements[i];
    const next = elements[i + 1];
    if (
      isSuppressed(b) &&
      next !== undefined &&
      isSuppressed(next) &&
      syncIsEmpty(next)
    ) {
      result.push(cancelSuppressed(b));
      i += 2;
    } else {
      result.push(b);
      i += 1;
    }
  }
  return result;
}

// ── Expand ─────────────────────────────────────────────────────────────────────
//
// Expand sync beats to explicit async with per-beat hand markers.
// Beats with MultiplexThrow are left in sync form.
//
// Rules:
//   (0,0)!  → EmptySlot
//   (0,0)   → EmptySlot EmptySlot
//   (0,N)!  → R N          (suppressed right)
//   (N,0)!  → L N          (suppressed left)
//   (0,N)   → R N EmptySlot (unsuppressed right)
//   (N,0)   → L N EmptySlot (unsuppressed left)
//   (N,M)   → kept as-is
//
// Then remove hand annotations already implied by strict R-L alternation.

function expandAll(elements: NotationElement[]): NotationElement[] {
  return elements.flatMap((b) => {
    if (!isSyncLike(b)) return [b];
    if (isMultiplex(b.left) || isMultiplex(b.right)) return [b];

    const suppressed = isSuppressed(b);

    if (syncIsEmpty(b)) {
      return suppressed ? [EMPTY_SLOT] : [EMPTY_SLOT, EMPTY_SLOT];
    }

    if (syncIsSingleHand(b)) {
      const hand = (b.left as Throw).value === 0 ? "right" : "left";
      const active = syncActiveThrow(b) as Throw;
      const slots: NotationElement[] = [mkAnnotation(hand), mkAsync(active)];
      if (!suppressed) slots.push(EMPTY_SLOT);
      return slots;
    }

    return [b];
  });
}

function removeRedundantMarkers(
  elements: NotationElement[],
): NotationElement[] {
  const result: NotationElement[] = [];
  let expected: "left" | "right" | null = null;

  for (const el of elements) {
    if (el.kind === "annotation") {
      if (el.hand === expected) continue; // redundant
      expected = el.hand;
      result.push(el);
    } else if (el.kind === "async" || el.kind === "empty") {
      if (expected !== null) expected = expected === "right" ? "left" : "right";
      result.push(el);
    } else {
      expected = null;
      result.push(el);
    }
  }

  return result;
}

export function applyExpand(elements: NotationElement[]): NotationElement[] {
  return removeRedundantMarkers(expandAll(elements));
}

// ── Preset pipelines ──────────────────────────────────────────────────────────

export type Transform = (elements: NotationElement[]) => NotationElement[];

export const TRANSFORMS = {
  halve: applyHalve as Transform,
  cancelPairs: applyCancelPairs,
  expand: applyExpand,
} as const;

export function applyPipeline(
  elements: SuppressedSyncBeat[],
  pipeline: Transform[],
): NotationElement[] {
  return pipeline.reduce(
    (els: NotationElement[], fn) => fn(els),
    elements as NotationElement[],
  );
}
