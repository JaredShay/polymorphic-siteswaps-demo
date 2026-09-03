// ── API types (from server / mock data) ──────────────────────────────────────

export type HandThrow = {
  label: string; // "6x", "ax", "3" — single throw label
  value: number; // numeric value for arc geometry
  cross: boolean;
};

export type BeatHand = {
  throws: HandThrow[]; // >1 only for multiplex e.g. [3, 4]
};

export type ApiBeat = {
  index: number; // position in the cycle (0-based)
  left?: BeatHand; // absent = left hand silent this beat
  right?: BeatHand; // absent = right hand silent this beat
  suppressed: boolean; // whether ! appears in notation
};

export type Rhythm = {
  n: number;
  leftBeats: number[];
  rightBeats: number[];
};

export type Pattern = {
  id: string;
  halved: string;
  simplified: string;
  balls: number;
  state: string;
  family: string; // base rhythm key, e.g. "3over2" (never includes _2cycle)
  cycles: number; // 1 or 2
  length: number;
  rhythm: Rhythm;
  beats: ApiBeat[];
};

// ── Generator params ─────────────────────────────────────────────────────────

export type GeneratorParams = {
  rhythm: Rhythm;
  balls: number;
  cycles: number;
  groundLimit: number;
  activeLimit: number;
  mode: "ordered" | "sampled";
  family: string;
};

// ── Filters ──────────────────────────────────────────────────────────────────

export type FilterState = {
  balls: Set<string>;
  family: Set<string>;
  state: Set<string>;
  cycles: Set<string>;
};

// ── Generation session ────────────────────────────────────────────────────────

export type GenerationSession = {
  id: string;
  timestamp: number;
  params: GeneratorParams[];
  filters: FilterState;
  patterns: Pattern[];
};
