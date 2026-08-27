import type { Rhythm } from "../types";

export type RhythmPreset = {
  id: string;
  label: string;
  rhythm: Rhythm;
};

// One preset per unique rhythm. Data files are data/{id}.json.
export const RHYTHM_PRESETS: RhythmPreset[] = [
  {
    id: "3over2",
    label: "3 : 2",
    rhythm: { n: 6, leftBeats: [0, 3], rightBeats: [0, 2, 4] },
  },
  {
    id: "4over3",
    label: "4 : 3",
    rhythm: { n: 12, leftBeats: [0, 4, 8], rightBeats: [0, 3, 6, 9] },
  },
  {
    id: "5over2",
    label: "5 : 2",
    rhythm: { n: 10, leftBeats: [0, 5], rightBeats: [0, 2, 4, 6, 8] },
  },
  {
    id: "5over3",
    label: "5 : 3",
    rhythm: { n: 15, leftBeats: [0, 5, 10], rightBeats: [0, 3, 6, 9, 12] },
  },
  {
    id: "5over4",
    label: "5 : 4",
    rhythm: { n: 20, leftBeats: [0, 5, 10, 15], rightBeats: [0, 4, 8, 12, 16] },
  },
  {
    id: "332",
    label: "332",
    rhythm: { n: 8, leftBeats: [0, 4], rightBeats: [0, 3, 6] },
  },
  {
    id: "clave",
    label: "Clave",
    rhythm: { n: 16, leftBeats: [0, 4, 8, 12], rightBeats: [0, 3, 6, 10, 12] },
  },
];
