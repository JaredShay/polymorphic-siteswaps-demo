import { useState, useEffect, useRef } from "react";
import type { Rhythm } from "../../types";
import { RHYTHM_PRESETS } from "../../data/rhythmPresets";
import RhythmIcon from "../RhythmIcon/RhythmIcon";
import "./RhythmSelector.css";

export type RhythmSelection =
  | { type: "presets"; families: string[] }
  | { type: "custom"; rhythm: Rhythm };

type CustomConfig = {
  leftLength: number;
  rightLength: number;
  leftBeats: Set<number>;
  rightBeats: Set<number>;
};

const DEFAULT_CUSTOM: CustomConfig = {
  leftLength: 2,
  rightLength: 3,
  leftBeats: new Set([0]),
  rightBeats: new Set([0]),
};

interface Props {
  onChange: (selection: RhythmSelection) => void;
}

export default function RhythmSelector({ onChange }: Props) {
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(
    new Set(["3over2"]),
  );
  const [customActive, setCustomActive] = useState(false);
  // customConfig is declared here; used fully in Task 4
  const [customConfig] = useState<CustomConfig>(DEFAULT_CUSTOM);

  // Skip first render — App.tsx initialises rhythmSelection to match our defaults
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!customActive) {
      onChange({ type: "presets", families: Array.from(selectedFamilies) });
    }
  }, [selectedFamilies, customActive]); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePreset(id: string) {
    setSelectedFamilies((prev) => {
      if (prev.has(id) && prev.size === 1) return prev; // keep at least one
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (customActive) setCustomActive(false);
  }

  return (
    <div className="rhythm-selector">
      <div className="rhythm-selector__icons">
        {RHYTHM_PRESETS.map((p) => (
          <button
            key={p.id}
            className={[
              "rhythm-selector__icon-btn",
              selectedFamilies.has(p.id) && !customActive
                ? "rhythm-selector__icon-btn--active"
                : "",
              customActive ? "rhythm-selector__icon-btn--muted" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => togglePreset(p.id)}
            aria-pressed={selectedFamilies.has(p.id) && !customActive}
            disabled={customActive}
            aria-label={p.label.replace(" : ", " over ")}
          >
            <RhythmIcon
              rhythm={p.rhythm}
              name={p.label}
              label={p.label.replace(" : ", ":")}
              size={80}
            />
          </button>
        ))}

        <button
          className={[
            "rhythm-selector__icon-btn",
            "rhythm-selector__icon-btn--custom",
            customActive ? "rhythm-selector__icon-btn--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setCustomActive(true)}
          aria-pressed={customActive}
          aria-label="Custom rhythm"
        >
          <svg viewBox="0 0 128 128" width={80} height={80} aria-hidden="true">
            <circle
              cx={64}
              cy={64}
              r={52}
              fill="none"
              strokeDasharray="6 4"
              className="rhythm-selector__custom-ring"
            />
            <text
              x={64}
              y={64}
              textAnchor="middle"
              dominantBaseline="middle"
              className="rhythm-selector__custom-plus"
            >
              +
            </text>
          </svg>
        </button>
      </div>
      {/* Custom expansion panel added in Task 4 */}
      <div data-testid="custom-config-placeholder" style={{ display: "none" }}>
        {customConfig.leftLength}
      </div>
    </div>
  );
}
