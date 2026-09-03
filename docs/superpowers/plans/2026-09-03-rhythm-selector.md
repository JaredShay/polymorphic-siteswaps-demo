# Rhythm Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FilterPanel rhythm chips and PresetsGrid with a unified `RhythmSelector` that uses compact visual icons, supports multi-select presets, and adds a fully custom rhythm builder.

**Architecture:** A new `RhythmSelector` component owns all rhythm selection state internally and emits a `RhythmSelection` union type upward. `FilterState` drops `family`. `App.tsx` initializes rhythm to `{type:"presets",families:["3over2"]}` and calls `generate` whenever `RhythmSelector` fires `onChange`. `filtersToParamSets` is updated to accept `RhythmSelection` alongside the remaining `FilterState`. The custom rhythm computes period `n = lcm(leftLength, rightLength)` and maps per-hand slot indices into the shared period.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react, plain CSS per component

**Spec:** `docs/superpowers/specs/2026-09-03-rhythm-selector-design.md`

## Global Constraints

- Per-hand length range: 2–8 inclusive
- At least one preset must remain selected at all times (when not in custom mode)
- At least one beat per hand must remain active in custom mode
- Custom mode is mutually exclusive with preset selection
- Period `n = lcm(leftLength, rightLength)`; slot `s` maps to period position `s * (n / handLength)`
- Test command: `npm test` (runs `vitest run`)
- No new npm packages

---

### Task 1: `lcm`/`gcd` utility

**Files:**
- Create: `src/utils/math.ts`
- Create: `src/utils/math.test.ts`

**Interfaces:**
- Produces: `export function gcd(a: number, b: number): number`, `export function lcm(a: number, b: number): number`

- [ ] **Step 1: Write failing tests**

```typescript
// src/utils/math.test.ts
import { describe, it, expect } from "vitest";
import { gcd, lcm } from "./math";

describe("gcd", () => {
  it("gcd(12, 8) = 4", () => expect(gcd(12, 8)).toBe(4));
  it("gcd(7, 3) = 1 (co-prime)", () => expect(gcd(7, 3)).toBe(1));
  it("gcd(6, 6) = 6", () => expect(gcd(6, 6)).toBe(6));
});

describe("lcm", () => {
  it("lcm(4, 6) = 12", () => expect(lcm(4, 6)).toBe(12));
  it("lcm(3, 4) = 12", () => expect(lcm(3, 4)).toBe(12));
  it("lcm(6, 6) = 6 (equal)", () => expect(lcm(6, 6)).toBe(6));
  it("lcm(2, 8) = 8 (one divides other)", () => expect(lcm(2, 8)).toBe(8));
  it("lcm(3, 5) = 15 (co-prime)", () => expect(lcm(3, 5)).toBe(15));
});
```

- [ ] **Step 2: Run to confirm failure**

```
npm test -- src/utils/math.test.ts
```
Expected: FAIL with "Cannot find module './math'"

- [ ] **Step 3: Implement**

```typescript
// src/utils/math.ts
export function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}
```

- [ ] **Step 4: Run to confirm passing**

```
npm test -- src/utils/math.test.ts
```
Expected: 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/utils/math.ts src/utils/math.test.ts
git commit -m "feat: add lcm/gcd utility"
```

---

### Task 2: Update RhythmIcon — centered label and size prop

**Files:**
- Modify: `src/components/RhythmIcon/RhythmIcon.tsx`
- Modify: `src/components/RhythmIcon/RhythmIcon.css`

**Interfaces:**
- Produces: `RhythmIcon` now accepts `label?: string` (SVG center text) and `size?: number` (px). Existing callers with only `rhythm` and `name` continue to work — the span below is shown when `label` is absent.

- [ ] **Step 1: Replace RhythmIcon.tsx**

```typescript
// src/components/RhythmIcon/RhythmIcon.tsx
import type { Rhythm } from "../../types";
import { ringPathFromBeats } from "../../utils/geometry";
import "./RhythmIcon.css";

interface Props {
  rhythm: Rhythm;
  name: string;    // aria-label on the SVG
  label?: string;  // if provided: shown as centered SVG text; span below is hidden
  size?: number;   // explicit px width/height for the outer div
}

const r = 52, cx = 64, cy = 64;

export default function RhythmIcon({ rhythm, name, label, size }: Props) {
  const { n, leftBeats, rightBeats } = rhythm;

  return (
    <div
      className="rhythm-icon"
      style={size ? { width: size, height: size } : undefined}
    >
      <svg
        viewBox="0 0 128 128"
        className="rhythm-icon__svg"
        aria-label={name}
      >
        <circle cx={cx} cy={cy} r={r} className="rhythm-icon__ring" />
        <path
          d={ringPathFromBeats(rightBeats, n, r, cx, cy)}
          fill="none"
          className="rhythm-icon__poly-right"
        />
        <path
          d={ringPathFromBeats(leftBeats, n, r, cx, cy)}
          fill="none"
          className="rhythm-icon__poly-left"
        />
        {label && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            className="rhythm-icon__ratio"
          >
            {label}
          </text>
        )}
      </svg>
      {!label && <span className="rhythm-icon__name">{name}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Append CSS class to RhythmIcon.css**

Add at the end of `src/components/RhythmIcon/RhythmIcon.css`:

```css
.rhythm-icon__ratio {
  font-family: var(--font-mono);
  font-size: 28px;
  fill: var(--text-hi);
  font-weight: 500;
  letter-spacing: -0.02em;
  pointer-events: none;
}
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```
Expected: no errors (PresetsGrid still compiles because `label` is optional)

- [ ] **Step 4: Commit**

```bash
git add src/components/RhythmIcon/RhythmIcon.tsx src/components/RhythmIcon/RhythmIcon.css
git commit -m "feat: add label overlay and size prop to RhythmIcon"
```

---

### Task 3: RhythmSelector — preset icon grid with multi-select

**Files:**
- Create: `src/components/RhythmSelector/RhythmSelector.tsx`
- Create: `src/components/RhythmSelector/RhythmSelector.css`
- Create: `src/components/RhythmSelector/RhythmSelector.test.tsx`

**Interfaces:**
- Consumes: `RhythmIcon` (rhythm, name, label, size); `RHYTHM_PRESETS`; `Rhythm` from `../../types`
- Produces:
  ```typescript
  export type RhythmSelection =
    | { type: "presets"; families: string[] }
    | { type: "custom"; rhythm: Rhythm };

  // Props
  interface Props { onChange: (selection: RhythmSelection) => void }

  export default function RhythmSelector(props: Props): JSX.Element
  ```

Note on `onChange` timing: `RhythmSelector` uses a mount-skip ref so `onChange` is NOT called on initial render. `App.tsx` initializes `rhythmSelection` to match the component's default state `{type:"presets",families:["3over2"]}`, so no initial sync call is needed.

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/RhythmSelector/RhythmSelector.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RhythmSelector from "./RhythmSelector";
import type { RhythmSelection } from "./RhythmSelector";

describe("RhythmSelector preset icons", () => {
  it("renders 7 preset buttons and 1 custom button", () => {
    render(<RhythmSelector onChange={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(8);
  });

  it("does not call onChange on initial render", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onChange when a second preset is toggled on", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("4 over 3"));
    const call = onChange.mock.calls.at(-1)![0] as RhythmSelection;
    expect(call.type).toBe("presets");
    expect((call as { type: "presets"; families: string[] }).families).toContain("4over3");
    expect((call as { type: "presets"; families: string[] }).families).toContain("3over2");
  });

  it("does not deselect the last active preset", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    // 3over2 is the sole selected preset — clicking it must not fire onChange
    fireEvent.click(screen.getByLabelText("3 over 2"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders the custom button", () => {
    render(<RhythmSelector onChange={() => {}} />);
    expect(screen.getByLabelText("Custom rhythm")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```
npm test -- src/components/RhythmSelector/RhythmSelector.test.tsx
```
Expected: FAIL with "Cannot find module './RhythmSelector'"

- [ ] **Step 3: Create RhythmSelector.tsx**

```typescript
// src/components/RhythmSelector/RhythmSelector.tsx
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
```

- [ ] **Step 4: Create RhythmSelector.css**

```css
/* src/components/RhythmSelector/RhythmSelector.css */
.rhythm-selector__icons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.rhythm-selector__icon-btn {
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-chip);
  padding: var(--s2);
  cursor: pointer;
  line-height: 0;
  transition:
    border-color 0.15s,
    opacity 0.15s,
    background 0.15s;
}

.rhythm-selector__icon-btn:hover:not(:disabled) {
  border-color: var(--hairline-strong);
}

.rhythm-selector__icon-btn--active {
  border-color: var(--accent);
  background: rgba(255, 178, 92, 0.08);
}

.rhythm-selector__icon-btn--muted {
  opacity: 0.35;
  pointer-events: none;
}

.rhythm-selector__icon-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.rhythm-selector__custom-ring {
  stroke: var(--text-mid);
  stroke-width: 1.5;
}

.rhythm-selector__custom-plus {
  font-family: var(--font-mono);
  font-size: 44px;
  fill: var(--text-mid);
  font-weight: 300;
}

.rhythm-selector__icon-btn--active .rhythm-selector__custom-ring {
  stroke: var(--accent);
}

.rhythm-selector__icon-btn--active .rhythm-selector__custom-plus {
  fill: var(--accent);
}
```

- [ ] **Step 5: Run tests**

```
npm test -- src/components/RhythmSelector/RhythmSelector.test.tsx
```
Expected: 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/RhythmSelector/
git commit -m "feat: add RhythmSelector preset icon grid"
```

---

### Task 4: RhythmSelector — custom expansion panel

**Files:**
- Modify: `src/components/RhythmSelector/RhythmSelector.tsx`
- Modify: `src/components/RhythmSelector/RhythmSelector.css`
- Modify: `src/components/RhythmSelector/RhythmSelector.test.tsx`

**Interfaces:**
- Consumes: `lcm` from `../../utils/math`
- Produces: same `RhythmSelector`; when custom is active, `onChange` fires with `{type:"custom", rhythm: Rhythm}` where `rhythm` is derived from `customConfig` via `configToRhythm`

- [ ] **Step 1: Append failing tests to RhythmSelector.test.tsx**

Add these imports at the top of the file:
```typescript
import { RHYTHM_PRESETS } from "../../data/rhythmPresets";
```

Append to the file:
```typescript
describe("Custom mode", () => {
  it("disables all preset buttons when custom is active", () => {
    render(<RhythmSelector onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    RHYTHM_PRESETS.forEach((p) => {
      expect(screen.getByLabelText(p.label.replace(" : ", " over "))).toBeDisabled();
    });
  });

  it("emits a custom rhythm when custom is activated", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    const call = onChange.mock.calls.at(-1)![0] as RhythmSelection;
    expect(call.type).toBe("custom");
    expect((call as { type: "custom"; rhythm: { n: number } }).rhythm.n).toBeGreaterThan(0);
  });

  it("shows the custom config panel when custom is active", () => {
    render(<RhythmSelector onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    expect(screen.getByLabelText("Left hand length")).toBeInTheDocument();
    expect(screen.getByLabelText("Right hand length")).toBeInTheDocument();
  });

  it("does not deselect the last beat in a hand", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    const callsBefore = onChange.mock.calls.length;
    // Default leftBeats = {0} — clicking slot 0 must not change state
    fireEvent.click(screen.getByLabelText("Left beat 0"));
    expect(onChange.mock.calls.length).toBe(callsBefore);
  });

  it("extends beat grid when left length increases", () => {
    render(<RhythmSelector onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    // default leftLength = 2
    fireEvent.click(screen.getByLabelText("Increase left length"));
    // now leftLength = 3; expect 3 left beat slots
    expect(screen.getAllByLabelText(/^Left beat \d+$/)).toHaveLength(3);
  });

  it("selecting a preset while custom is active deactivates custom", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    fireEvent.click(screen.getByLabelText("3 over 2")); // re-enable presets
    const call = onChange.mock.calls.at(-1)![0] as RhythmSelection;
    expect(call.type).toBe("presets");
  });
});
```

- [ ] **Step 2: Run to confirm new tests fail**

```
npm test -- src/components/RhythmSelector/RhythmSelector.test.tsx
```
Expected: 5 original pass, 6 new fail

- [ ] **Step 3: Replace RhythmSelector.tsx with full implementation**

```typescript
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
```

- [ ] **Step 4: Append custom panel CSS to RhythmSelector.css**

```css
.rhythm-selector__custom-panel {
  margin-top: var(--s4);
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.rhythm-selector__hand-row {
  display: flex;
  align-items: center;
  gap: var(--s4);
  flex-wrap: wrap;
}

.rhythm-selector__hand-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--text-mid);
  width: 40px;
  flex-shrink: 0;
}

.rhythm-selector__stepper {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.rhythm-selector__stepper-btn {
  font-family: var(--font-mono);
  font-size: 16px;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-chip);
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: border-color 0.15s;
}

.rhythm-selector__stepper-btn:hover:not(:disabled) {
  border-color: var(--hairline-strong);
  color: var(--text-hi);
}

.rhythm-selector__stepper-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.rhythm-selector__stepper-value {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-hi);
  width: 18px;
  text-align: center;
}

.rhythm-selector__beat-grid {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.rhythm-selector__beat-slot {
  width: 22px;
  height: 22px;
  border: 1px solid var(--hairline);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition:
    background 0.12s,
    border-color 0.12s;
}

.rhythm-selector__beat-slot:hover {
  border-color: var(--hairline-strong);
}

.rhythm-selector__beat-slot--active {
  background: var(--accent);
  border-color: var(--accent);
}

.rhythm-selector__beat-slot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run all RhythmSelector tests**

```
npm test -- src/components/RhythmSelector/RhythmSelector.test.tsx
```
Expected: all 11 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/RhythmSelector/
git commit -m "feat: add custom rhythm expansion panel to RhythmSelector"
```

---

### Task 5: Wire into App — update types, remove PresetsGrid

This task touches several files in one go to keep the codebase compilable at each step. Do them in the order listed.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/utils/url.ts`
- Modify: `src/utils/url.test.ts`
- Modify: `src/hooks/useGenerator.ts`
- Modify: `src/components/FilterPanel/FilterPanel.tsx`
- Modify: `src/App.tsx`
- Delete: `src/components/PresetsGrid/PresetsGrid.tsx`
- Delete: `src/components/PresetsGrid/PresetsGrid.css`

**Interfaces:**
- Consumes: `RhythmSelection` from `./components/RhythmSelector/RhythmSelector`
- Produces: working app with `RhythmSelector` in the generator section, `PresetsGrid` gone, `FilterPanel` without the Rhythm row

#### 5a — Remove `family` from `FilterState`

- [ ] **Step 1: Update `src/types.ts`**

Find the `FilterState` type and remove the `family` line:

```typescript
// Before
export type FilterState = {
  balls: Set<string>;
  family: Set<string>;
  state: Set<string>;
  cycles: Set<string>;
};

// After
export type FilterState = {
  balls: Set<string>;
  state: Set<string>;
  cycles: Set<string>;
};
```

#### 5b — Update `url.ts`

- [ ] **Step 2: Replace `buildUrl` in `src/utils/url.ts`**

Drop the `ff` param (was `filters.family`):

```typescript
export function buildUrl(pattern: Pattern, filters: FilterState): string {
  const params = new URLSearchParams({
    ph: pattern.halved,
    psimp: pattern.simplified,
    pr: encodePr(pattern.rhythm),
    pbeats: encodePbeats(pattern.beats),
    pb: String(pattern.balls),
    pf: pattern.family,
    ps: pattern.state,
    pc: String(pattern.cycles),
    fb: Array.from(filters.balls).sort().join(","),
    fs: Array.from(filters.state).sort().join(","),
    fc: Array.from(filters.cycles).sort().join(","),
  });

  const qs = params
    .toString()
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2C/g, ",")
    .replace(/%21/g, "!");

  return `${location.origin}${location.pathname}?${qs}`;
}
```

#### 5c — Update `url.test.ts`

- [ ] **Step 3: Remove `family` from the `buildUrl` call in `src/utils/url.test.ts`**

Find the `buildUrl` call in the test and update it:

```typescript
const url = buildUrl(mockPattern, {
  balls: new Set(["4"]),
  state: new Set(["ground", "active"]),
  cycles: new Set(["1"]),
});
```

#### 5d — Update `useGenerator.ts`

- [ ] **Step 4: Remove `family` from serialize/deserialize in `src/hooks/useGenerator.ts`**

Replace `serializeSession`:
```typescript
function serializeSession(s: GenerationSession): object {
  return {
    ...s,
    filters: {
      balls: Array.from(s.filters.balls),
      state: Array.from(s.filters.state),
      cycles: Array.from(s.filters.cycles),
    },
  };
}
```

Replace `deserializeSession`:
```typescript
function deserializeSession(raw: Record<string, unknown>): GenerationSession {
  const f = raw.filters as Record<string, string[]>;
  return {
    ...(raw as Omit<GenerationSession, "filters">),
    filters: {
      balls: new Set(f.balls ?? []),
      state: new Set(f.state ?? []),
      cycles: new Set(f.cycles ?? []),
    },
  };
}
```

#### 5e — Update `FilterPanel`

- [ ] **Step 5: Replace `src/components/FilterPanel/FilterPanel.tsx`**

Remove the `RHYTHMS` constant and the Rhythm row:

```typescript
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
```

#### 5f — Rewrite `App.tsx`

- [ ] **Step 6: Replace `src/App.tsx`**

```typescript
import { useState, useCallback, useEffect } from "react";
import type { Pattern, FilterState, GeneratorParams, Rhythm } from "./types";
import type { RhythmSelection } from "./components/RhythmSelector/RhythmSelector";
import { RHYTHM_PRESETS } from "./data/rhythmPresets";
import { useGenerator } from "./hooks/useGenerator";
import { patternFromUrl, buildUrl } from "./utils/url";
import PatternHero from "./components/PatternHero/PatternHero";
import NotationDisplay from "./components/NotationDisplay/NotationDisplay";
import FilterPanel from "./components/FilterPanel/FilterPanel";
import RhythmSelector from "./components/RhythmSelector/RhythmSelector";
import PatternQueue from "./components/PatternQueue/PatternQueue";
import { buildJugglingLabUrl } from "./utils/jugglinglab";
import { toNotationBeats } from "./utils/beats";
import "./App.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10;

const DEFAULT_FILTERS: FilterState = {
  balls: new Set(["4", "5"]),
  state: new Set(["ground", "active"]),
  cycles: new Set(["1"]),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSet(raw: string | null, fallback: string): Set<string> {
  const set = new Set((raw ?? fallback).split(",").filter(Boolean));
  return set.size > 0 ? set : new Set(fallback.split(",").filter(Boolean));
}

function parseInitialFilters(): FilterState {
  const p = new URLSearchParams(location.search);
  return {
    balls: parseSet(p.get("fb"), "4,5"),
    state: parseSet(p.get("fs"), "ground,active"),
    cycles: parseSet(p.get("fc"), "1"),
  };
}

function filtersToParamSets(
  rhythmSelection: RhythmSelection,
  filters: FilterState,
): GeneratorParams[] {
  const ballsArr = Array.from(filters.balls).map(Number);
  const cyclesArr = Array.from(filters.cycles).map(Number);
  const hasGround = filters.state.has("ground");
  const hasActive = filters.state.has("active");

  type Combo = { family: string; balls: number; cycles: number; rhythm: Rhythm };
  const combos: Combo[] = [];

  if (rhythmSelection.type === "custom") {
    for (const balls of ballsArr) {
      for (const cycles of cyclesArr) {
        combos.push({ family: "custom", balls, cycles, rhythm: rhythmSelection.rhythm });
      }
    }
  } else {
    for (const family of rhythmSelection.families) {
      const preset = RHYTHM_PRESETS.find((r) => r.id === family);
      if (!preset) continue;
      for (const balls of ballsArr) {
        for (const cycles of cyclesArr) {
          combos.push({ family, balls, cycles, rhythm: preset.rhythm });
        }
      }
    }
  }

  if (combos.length === 0) return [];

  const perCombo = Math.max(1, Math.floor(DEFAULT_LIMIT / combos.length));
  const half = Math.floor(perCombo / 2);

  return combos.map(({ family, balls, cycles, rhythm }) => ({
    rhythm,
    balls,
    cycles,
    groundLimit: hasGround && hasActive ? half : hasGround ? perCombo : 0,
    activeLimit:
      hasGround && hasActive ? perCombo - half : hasActive ? perCombo : 0,
    mode: "sampled" as const,
    family,
  }));
}

function displayFamily(p: Pattern): string {
  return p.cycles > 1 ? `${p.family}_2cycle` : p.family;
}

// ── Component ─────────────────────────────────────────────────────────────────

const INIT_FILTERS = parseInitialFilters();
const INIT_URL_PATTERN = patternFromUrl(new URLSearchParams(location.search));

// Matches RhythmSelector's initial internal state; kept in sync manually.
const INIT_RHYTHM: RhythmSelection = { type: "presets", families: ["3over2"] };

export default function App() {
  const [filters, setFilters] = useState<FilterState>(INIT_FILTERS);
  const [rhythmSelection, setRhythmSelection] =
    useState<RhythmSelection>(INIT_RHYTHM);
  const {
    sessions,
    viewIndex,
    primaryIndex,
    status,
    generate,
    setViewIndex,
    setPrimaryIndex,
  } = useGenerator();

  const currentPatterns = sessions[viewIndex]?.patterns ?? [];
  const primaryPattern = currentPatterns[primaryIndex] ?? null;

  useEffect(() => {
    if (INIT_URL_PATTERN) return;
    const paramSets = filtersToParamSets(INIT_RHYTHM, INIT_FILTERS);
    if (paramSets.length > 0) generate(paramSets, INIT_FILTERS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (primaryPattern) {
      history.replaceState(null, "", buildUrl(primaryPattern, filters));
    }
  }, [primaryPattern, filters]);

  function handleGenerate() {
    const paramSets = filtersToParamSets(rhythmSelection, filters);
    if (paramSets.length === 0) return;
    generate(paramSets, filters);
  }

  const handleRhythmChange = useCallback(
    (selection: RhythmSelection) => {
      setRhythmSelection(selection);
      const paramSets = filtersToParamSets(selection, filters);
      if (paramSets.length > 0) generate(paramSets, filters);
    },
    [filters, generate],
  );

  function handleSelectPattern(index: number) {
    setPrimaryIndex(index);
  }

  function handleBack() {
    const nextIndex = viewIndex + 1;
    if (nextIndex >= sessions.length) return;
    setViewIndex(nextIndex);
    setPrimaryIndex(0);
    const historicalFilters = sessions[nextIndex]?.filters;
    if (historicalFilters) setFilters(historicalFilters);
  }

  function handleForward() {
    const nextIndex = viewIndex - 1;
    if (nextIndex < 0) return;
    setViewIndex(nextIndex);
    setPrimaryIndex(0);
    const historicalFilters = sessions[nextIndex]?.filters;
    if (historicalFilters) setFilters(historicalFilters);
  }

  const displayPattern =
    primaryPattern ??
    (INIT_URL_PATTERN && sessions.length === 0 ? INIT_URL_PATTERN : null);

  return (
    <div className="app">
      <nav className="app__nav">
        <b>Polymorphic Siteswaps</b>
      </nav>

      <PatternHero
        activePattern={displayPattern}
        generatedUrl={
          displayPattern
            ? buildJugglingLabUrl(
                displayPattern.simplified,
                displayFamily(displayPattern),
                displayPattern.balls,
              )
            : undefined
        }
      />

      {displayPattern && (
        <div className="app__section">
          <NotationDisplay
            halved={displayPattern.halved}
            simplified={displayPattern.simplified}
            notationBeats={toNotationBeats(
              displayPattern.beats,
              displayPattern.rhythm,
            )}
            family={displayFamily(displayPattern)}
            balls={displayPattern.balls}
            state={displayPattern.state}
          />
        </div>
      )}

      <PatternQueue
        patterns={currentPatterns}
        primaryIndex={primaryIndex}
        status={status}
        canGoBack={viewIndex < sessions.length - 1}
        canGoForward={viewIndex > 0}
        onSelect={handleSelectPattern}
        onBack={handleBack}
        onForward={handleForward}
      />

      <div className="app__generator">
        <h2 className="app__section-heading">Build a pattern</h2>
        <RhythmSelector onChange={handleRhythmChange} />
        <FilterPanel filters={filters} onChange={setFilters} />
        <button
          className="app__generate-btn"
          onClick={handleGenerate}
          disabled={status === "generating"}
        >
          {status === "generating" ? "Generating…" : "Generate"}
        </button>
      </div>

      <footer>
        <span>MIT License</span>
      </footer>
    </div>
  );
}
```

#### 5g — Delete PresetsGrid

- [ ] **Step 7: Delete PresetsGrid files**

```bash
git rm src/components/PresetsGrid/PresetsGrid.tsx src/components/PresetsGrid/PresetsGrid.css
```

#### 5h — Verify and commit

- [ ] **Step 8: Run full test suite**

```
npm test
```
Expected: all tests pass

- [ ] **Step 9: Type-check**

```
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add src/types.ts src/utils/url.ts src/utils/url.test.ts \
        src/hooks/useGenerator.ts \
        src/components/FilterPanel/FilterPanel.tsx \
        src/App.tsx
git commit -m "feat: wire RhythmSelector, drop family from FilterState, remove PresetsGrid"
```
