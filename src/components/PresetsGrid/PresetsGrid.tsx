import { memo } from "react";
import type { Pattern } from "../../types";
import RhythmIcon from "../RhythmIcon/RhythmIcon";
import { FAMILY_LABEL } from "../../utils/notation";
import "./PresetsGrid.css";

interface Props {
  patterns: Pattern[];
  activeId: string | null;
  onSelect: (pattern: Pattern) => void;
}

export default memo(function PresetsGrid({ patterns, activeId, onSelect }: Props) {
  return (
    <section>
      <h2 className="presets-grid__heading">Presets</h2>
      <div className="presets-grid__grid">
        {patterns.map((p) => {
          const label = p.displayLabel ?? FAMILY_LABEL[p.family] ?? p.family;
          const name  = `${p.balls}b · ${p.state.charAt(0).toUpperCase() + p.state.slice(1)}`;
          return (
            <button
              key={p.id}
              className={`presets-grid__card${activeId === p.id ? " presets-grid__card--active" : ""}`}
              onClick={() => onSelect(p)}
              aria-pressed={activeId === p.id}
            >
              <RhythmIcon rhythm={p.rhythm} name={name} label={label} />
            </button>
          );
        })}
      </div>
    </section>
  );
});
