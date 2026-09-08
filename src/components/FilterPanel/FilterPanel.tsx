import type { FilterState } from "../../types";
import "./FilterPanel.css";

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

function toggle(set: Set<string>, value: string): Set<string> {
  if (set.has(value) && set.size === 1) return set;
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const BALLS = ["4", "5"];
const STATES = [
  { value: "active", label: "Excited" },
  { value: "ground", label: "Ground" },
];
const PERIODS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
];

export default function FilterPanel({ filters, onChange }: Props) {
  function handleToggle(group: keyof FilterState, value: string) {
    onChange({ ...filters, [group]: toggle(filters[group], value) });
  }

  return (
    <div className="filter-panel">
      <div className="filter-panel__row">
        <span className="filter-panel__label">Balls</span>
        <div className="filter-panel__chips">
          {BALLS.map((v) => (
            <button
              key={v}
              className="chip"
              aria-pressed={filters.balls.has(v) ? "true" : "false"}
              onClick={() => handleToggle("balls", v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-panel__row">
        <span className="filter-panel__label">State</span>
        <div className="filter-panel__chips">
          {STATES.map(({ value, label }) => (
            <button
              key={value}
              className="chip"
              aria-pressed={filters.state.has(value) ? "true" : "false"}
              onClick={() => handleToggle("state", value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-panel__row">
        <span className="filter-panel__label">Period</span>
        <div className="filter-panel__chips">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              className="chip"
              aria-pressed={filters.cycles.has(value) ? "true" : "false"}
              onClick={() => handleToggle("cycles", value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
