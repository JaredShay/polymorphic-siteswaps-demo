// Notation element types mirroring lib/siteswap/notation.rb.
// All types are readonly — the generator never mutates notation objects.

export type Throw = {
  readonly value: number;
  readonly cross: boolean;
};

export type MultiplexThrow = {
  readonly throws: readonly Throw[]; // sorted by value ascending, min 2 elements
};

export type ThrowOrMultiplex = Throw | MultiplexThrow;

export type SuppressedSyncBeat = {
  readonly kind: "suppressed";
  readonly left: ThrowOrMultiplex;
  readonly right: ThrowOrMultiplex;
};

export type SyncBeat = {
  readonly kind: "sync";
  readonly left: ThrowOrMultiplex;
  readonly right: ThrowOrMultiplex;
};

export type AsyncThrow = {
  readonly kind: "async";
  readonly throw: Throw;
};

export type EmptySlot = { readonly kind: "empty" };

export type HandAnnotation = {
  readonly kind: "annotation";
  readonly hand: "left" | "right";
};

export type NotationElement =
  SuppressedSyncBeat | SyncBeat | AsyncThrow | EmptySlot | HandAnnotation;

// BeatArray: raw generator output. One [left, right] pair per beat in the period.
// Index 0 = left hand throw, index 1 = right hand throw.
export type BeatArray = ReadonlyArray<
  readonly [ThrowOrMultiplex, ThrowOrMultiplex]
>;

// ── Type guards ───────────────────────────────────────────────────────────────

export function isThrow(t: ThrowOrMultiplex): t is Throw {
  return "value" in t;
}

export function isMultiplex(t: ThrowOrMultiplex): t is MultiplexThrow {
  return "throws" in t;
}

export function isSuppressed(el: NotationElement): el is SuppressedSyncBeat {
  return el.kind === "suppressed";
}

export function isSyncBeat(el: NotationElement): el is SyncBeat {
  return el.kind === "sync";
}

export function isSyncLike(
  el: NotationElement,
): el is SuppressedSyncBeat | SyncBeat {
  return el.kind === "suppressed" || el.kind === "sync";
}

export function isAsync(el: NotationElement): el is AsyncThrow {
  return el.kind === "async";
}

export function isEmptySlot(el: NotationElement): el is EmptySlot {
  return el.kind === "empty";
}

export function isAnnotation(el: NotationElement): el is HandAnnotation {
  return el.kind === "annotation";
}

// ── Constructors ──────────────────────────────────────────────────────────────

export function mkThrow(value: number, cross: boolean): Throw {
  return { value, cross };
}

export function mkMultiplex(throws: Throw[]): MultiplexThrow {
  return { throws: [...throws].sort((a, b) => a.value - b.value) };
}

export function mkSuppressed(
  left: ThrowOrMultiplex,
  right: ThrowOrMultiplex,
): SuppressedSyncBeat {
  return { kind: "suppressed", left, right };
}

export function mkSync(
  left: ThrowOrMultiplex,
  right: ThrowOrMultiplex,
): SyncBeat {
  return { kind: "sync", left, right };
}

export function mkAsync(t: Throw): AsyncThrow {
  return { kind: "async", throw: t };
}

export const EMPTY_SLOT: EmptySlot = { kind: "empty" };

export function mkAnnotation(hand: "left" | "right"): HandAnnotation {
  return { kind: "annotation", hand };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sum of throw values. For MultiplexThrow, sums all components. */
export function throwValue(t: ThrowOrMultiplex): number {
  return isThrow(t) ? t.value : t.throws.reduce((s, th) => s + th.value, 0);
}

export function syncIsEmpty(b: SuppressedSyncBeat | SyncBeat): boolean {
  return throwValue(b.left) === 0 && throwValue(b.right) === 0;
}

export function syncIsSingleHand(b: SuppressedSyncBeat | SyncBeat): boolean {
  return (throwValue(b.left) === 0) !== (throwValue(b.right) === 0);
}

export function syncActiveThrow(
  b: SuppressedSyncBeat | SyncBeat,
): ThrowOrMultiplex {
  return throwValue(b.left) === 0 ? b.right : b.left;
}

export function cancelSuppressed(b: SuppressedSyncBeat): SyncBeat {
  return { kind: "sync", left: b.left, right: b.right };
}

/** Convert BeatArray to SuppressedSyncBeat[] (the input form for transforms). */
export function beatArrayToElements(ba: BeatArray): SuppressedSyncBeat[] {
  return ba.map(([l, r]) => mkSuppressed(l, r));
}
