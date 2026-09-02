import { useState, useCallback, useEffect } from "react";
import type { Pattern, FilterState, GeneratorParams } from "./types";
import { RHYTHM_PRESETS } from "./data/rhythmPresets";
import { useGenerator } from "./hooks/useGenerator";
import { patternFromUrl, buildUrl } from "./utils/url";
import PatternHero from "./components/PatternHero/PatternHero";
import NotationDisplay from "./components/NotationDisplay/NotationDisplay";
import FilterPanel from "./components/FilterPanel/FilterPanel";
import PresetsGrid from "./components/PresetsGrid/PresetsGrid";
import PatternQueue from "./components/PatternQueue/PatternQueue";
import { buildJugglingLabUrl } from "./utils/jugglinglab";
import { toNotationBeats } from "./utils/beats";
import "./App.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10;

const DEFAULT_FILTERS: FilterState = {
  balls: new Set(["4", "5"]),
  family: new Set(["3over2"]),
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
    family: parseSet(p.get("ff"), "3over2"),
    state: parseSet(p.get("fs"), "ground,active"),
    cycles: parseSet(p.get("fc"), "1"),
  };
}

function filtersToParams(filters: FilterState): GeneratorParams | null {
  const family = Array.from(filters.family)[0];
  const preset = RHYTHM_PRESETS.find((r) => r.id === family);
  if (!preset) return null;

  const balls = parseInt(Array.from(filters.balls)[0] ?? "4");
  const cycles = parseInt(Array.from(filters.cycles)[0] ?? "1");

  const hasGround = filters.state.has("ground");
  const hasActive = filters.state.has("active");
  const half = Math.floor(DEFAULT_LIMIT / 2);

  return {
    rhythm: preset.rhythm,
    balls,
    cycles,
    groundLimit: hasGround && hasActive ? half : hasGround ? DEFAULT_LIMIT : 0,
    activeLimit:
      hasGround && hasActive
        ? DEFAULT_LIMIT - half
        : hasActive
          ? DEFAULT_LIMIT
          : 0,
  };
}

function displayFamily(p: Pattern): string {
  return p.cycles > 1 ? `${p.family}_2cycle` : p.family;
}

// ── Component ─────────────────────────────────────────────────────────────────

const INIT_FILTERS = parseInitialFilters();
const INIT_URL_PATTERN = patternFromUrl(new URLSearchParams(location.search));

export default function App() {
  const [filters, setFilters] = useState<FilterState>(INIT_FILTERS);
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

  // On mount: restore from URL or auto-generate
  useEffect(() => {
    if (INIT_URL_PATTERN) {
      // URL has a full pattern — no generation needed, just show it
      // The hook starts with empty sessions; we don't auto-generate on URL load
      return;
    }
    const params = filtersToParams(INIT_FILTERS);
    if (params) {
      const family = Array.from(INIT_FILTERS.family)[0] ?? "3over2";
      generate(params, INIT_FILTERS, family);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when primary pattern changes
  useEffect(() => {
    if (primaryPattern) {
      history.replaceState(null, "", buildUrl(primaryPattern, filters));
    }
  }, [primaryPattern, filters]);

  function handleGenerate() {
    const params = filtersToParams(filters);
    if (!params) return;
    const family = Array.from(filters.family)[0] ?? "3over2";
    generate(params, filters, family);
  }

  const handleSelectPreset = useCallback(
    (familyId: string) => {
      const next = { ...filters, family: new Set([familyId]) };
      setFilters(next);
      const params = filtersToParams(next);
      if (params) generate(params, next, familyId);
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
    // Restore filters to those used for this historical session
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

  const activeFamilyId =
    filters.family.size === 1 ? Array.from(filters.family)[0] : null;

  // Determine the rhythm being generated (for skeleton slots)
  const generatingFamily =
    status === "generating" ? Array.from(filters.family)[0] : null;
  const generatingPreset = generatingFamily
    ? RHYTHM_PRESETS.find((r) => r.id === generatingFamily)
    : null;

  // Show URL pattern above sessions if we loaded from URL with no sessions yet
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
        generatingRhythm={generatingPreset?.rhythm ?? null}
        limit={DEFAULT_LIMIT}
        sessionIndex={viewIndex}
        sessionCount={sessions.length}
        canGoBack={viewIndex < sessions.length - 1}
        canGoForward={viewIndex > 0}
        onSelect={handleSelectPattern}
        onBack={handleBack}
        onForward={handleForward}
      />

      <div className="app__generator">
        <h2 className="app__section-heading">Build a pattern</h2>
        <FilterPanel filters={filters} onChange={setFilters} />
        <button
          className="app__generate-btn"
          onClick={handleGenerate}
          disabled={status === "generating"}
        >
          {status === "generating" ? "Generating…" : "Generate"}
        </button>
      </div>

      <PresetsGrid
        presets={RHYTHM_PRESETS}
        activeFamilyId={activeFamilyId}
        onSelect={handleSelectPreset}
      />

      <footer>
        <span>MIT License</span>
      </footer>
    </div>
  );
}
