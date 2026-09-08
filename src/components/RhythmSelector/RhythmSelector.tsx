// src/components/RhythmSelector/RhythmSelector.tsx
import { useState, useEffect, useRef } from "react";
import type { Rhythm } from "../../types";
import { RHYTHM_PRESETS } from "../../data/rhythmPresets";
import { lcm } from "../../utils/math";
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

function configToRhythm(cfg: CustomConfig): Rhythm {
  const n = lcm(cfg.leftLength, cfg.rightLength);
  const leftScale = n / cfg.leftLength;
  const rightScale = n / cfg.rightLength;
  return {
    n,
    leftBeats: Array.from(cfg.leftBeats)
      .sort((a, b) => a - b)
      .map((s) => s * leftScale),
    rightBeats: Array.from(cfg.rightBeats)
      .sort((a, b) => a - b)
      .map((s) => s * rightScale),
  };
}

interface Props {
  onChange: (selection: RhythmSelection) => void;
}

export default function RhythmSelector({ onChange }: Props) {
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(
    new Set(["3over2"]),
  );
  const [customActive, setCustomActive] = useState(false);
  const [customConfig, setCustomConfig] =
    useState<CustomConfig>(DEFAULT_CUSTOM);

  // Skip first render — App.tsx initialises rhythmSelection to match our defaults
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (customActive) {
      onChange({ type: "custom", rhythm: configToRhythm(customConfig) });
    } else {
      onChange({ type: "presets", families: Array.from(selectedFamilies) });
    }
  }, [selectedFamilies, customActive, customConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePreset(id: string) {
    setSelectedFamilies((prev) => {
      if (prev.has(id) && prev.size === 1) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (customActive) setCustomActive(false);
  }

  function toggleBeat(hand: "left" | "right", slot: number) {
    setCustomConfig((prev) => {
      const key = hand === "left" ? "leftBeats" : "rightBeats";
      const current = prev[key];
      if (current.has(slot) && current.size === 1) return prev; // guard
      const next = new Set(current);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return { ...prev, [key]: next };
    });
  }

  function adjustLength(hand: "left" | "right", delta: number) {
    setCustomConfig((prev) => {
      const lenKey = hand === "left" ? "leftLength" : "rightLength";
      const beatsKey = hand === "left" ? "leftBeats" : "rightBeats";
      const newLen = Math.max(2, Math.min(8, prev[lenKey] + delta));
      if (newLen === prev[lenKey]) return prev;
      const filtered = new Set(
        Array.from(prev[beatsKey]).filter((s) => s < newLen),
      );
      return {
        ...prev,
        [lenKey]: newLen,
        [beatsKey]: filtered.size > 0 ? filtered : new Set([0]),
      };
    });
  }

  function handleIconsClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!customActive) return;
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-preset-id]",
    );
    if (btn?.dataset.presetId) {
      togglePreset(btn.dataset.presetId);
    }
  }

  return (
    <div className="rhythm-selector">
      <div className="rhythm-selector__icons" onClick={handleIconsClick}>
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
            data-preset-id={p.id}
            aria-label={p.label.replace(" : ", " over ")}
          >
            <RhythmIcon
              rhythm={p.rhythm}
              name={p.label}
              label={p.label.replace(" : ", ":")}
              size={80}
              decorative
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

      {customActive && (
        <div className="rhythm-selector__custom-panel">
          {(["left", "right"] as const).map((hand) => {
            const length =
              hand === "left"
                ? customConfig.leftLength
                : customConfig.rightLength;
            const beats =
              hand === "left"
                ? customConfig.leftBeats
                : customConfig.rightBeats;
            const label = hand === "left" ? "Left" : "Right";

            return (
              <div key={hand} className="rhythm-selector__hand-row">
                <span className="rhythm-selector__hand-label">{label}</span>

                <div className="rhythm-selector__stepper">
                  <button
                    className="rhythm-selector__stepper-btn"
                    onClick={() => adjustLength(hand, -1)}
                    disabled={length <= 2}
                    aria-label={`Decrease ${hand} length`}
                  >
                    −
                  </button>
                  <span
                    className="rhythm-selector__stepper-value"
                    aria-label={`${label} hand length`}
                  >
                    {length}
                  </span>
                  <button
                    className="rhythm-selector__stepper-btn"
                    onClick={() => adjustLength(hand, 1)}
                    disabled={length >= 8}
                    aria-label={`Increase ${hand} length`}
                  >
                    +
                  </button>
                </div>

                <div className="rhythm-selector__beat-grid">
                  {Array.from({ length }, (_, i) => (
                    <button
                      key={i}
                      className={[
                        "rhythm-selector__beat-slot",
                        beats.has(i) ? "rhythm-selector__beat-slot--active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => toggleBeat(hand, i)}
                      aria-pressed={beats.has(i)}
                      aria-label={`${label} beat ${i}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
