import { memo } from "react";
import type { RhythmPreset } from "../../data/rhythmPresets";
import RhythmIcon from "../RhythmIcon/RhythmIcon";
import "./PresetsGrid.css";

interface Props {
  presets: RhythmPreset[];
  activeFamilyId: string | null;
  onSelect: (familyId: string) => void;
}

export default memo(function PresetsGrid({ presets, activeFamilyId, onSelect }: Props) {
  return (
    <section>
      <h2 className="presets-grid__heading">Rhythms</h2>
      <div className="presets-grid__grid">
        {presets.map((p) => (
          <button
            key={p.id}
            className={`presets-grid__card${activeFamilyId === p.id ? " presets-grid__card--active" : ""}`}
            onClick={() => onSelect(p.id)}
            aria-pressed={activeFamilyId === p.id}
          >
            <RhythmIcon rhythm={p.rhythm} name={p.label} label={`${p.rhythm.n} beats`} />
          </button>
        ))}
      </div>
    </section>
  );
});
