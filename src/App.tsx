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

  const handleRhythmChange = useCallback((selection: RhythmSelection) => {
    setRhythmSelection(selection);
  }, []);

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
