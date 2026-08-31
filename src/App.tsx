import { useState, useCallback, useEffect } from "react";
import type { Pattern, FilterState } from "./types";
import { toNotationBeats } from "./utils/beats";
import { RHYTHM_PRESETS } from "./data/rhythmPresets";
import PatternHero from "./components/PatternHero/PatternHero";
import NotationDisplay from "./components/NotationDisplay/NotationDisplay";
import FilterPanel from "./components/FilterPanel/FilterPanel";
import PresetsGrid from "./components/PresetsGrid/PresetsGrid";
import { buildJugglingLabUrl } from "./utils/jugglinglab";
import "./App.css";

// Patterns as stored in data/{family}.json — id and family are assigned on load
type FilePattern = Omit<Pattern, "id" | "family">;

// ── URL helpers ────────────────────────────────────────────────────────────────

type UrlPattern = {
  halved: string;
  balls: number;
  family: string;
  state: string;
  cycles: number;
};

const DEFAULT_FILTERS: FilterState = {
  balls: new Set(["4", "5"]),
  family: new Set(["3over2"]),
  state: new Set(["ground", "active"]),
  cycles: new Set(["1"]),
};

function parseSet(raw: string | null, fallback: string): Set<string> {
  const set = new Set((raw ?? fallback).split(",").filter(Boolean));
  return set.size > 0 ? set : new Set(fallback.split(",").filter(Boolean));
}

function parseInitialState(): {
  urlPattern: UrlPattern | null;
  initialFilters: FilterState;
} {
  const p = new URLSearchParams(location.search);
  const ph = p.get("ph"),
    pb = p.get("pb"),
    pf = p.get("pf");
  const ps = p.get("ps"),
    pc = p.get("pc");

  const urlPattern =
    ph && pb && pf && ps && pc
      ? {
          halved: ph,
          balls: parseInt(pb),
          family: pf,
          state: ps,
          cycles: parseInt(pc),
        }
      : null;

  const initialFilters: FilterState = {
    balls: parseSet(p.get("fb"), "4,5"),
    family: parseSet(p.get("ff"), "3over2"),
    state: parseSet(p.get("fs"), "ground,active"),
    cycles: parseSet(p.get("fc"), "1"),
  };

  return { urlPattern, initialFilters };
}

function buildUrl(pattern: Pattern, filters: FilterState): string {
  const params = new URLSearchParams({
    ph: pattern.halved,
    pb: String(pattern.balls),
    pf: pattern.family,
    ps: pattern.state,
    pc: String(pattern.cycles),
    fb: Array.from(filters.balls).sort().join(","),
    ff: Array.from(filters.family).sort().join(","),
    fs: Array.from(filters.state).sort().join(","),
    fc: Array.from(filters.cycles).sort().join(","),
  });
  // Keep siteswap characters readable — these are all safe in query strings
  const qs = params
    .toString()
    .replace(/%28/g, "(")
    .replace(/%29/g, ")")
    .replace(/%2C/g, ",")
    .replace(/%21/g, "!");
  return `${location.origin}${location.pathname}?${qs}`;
}

// Parsed once on module load
const { urlPattern: INIT_PATTERN, initialFilters: INIT_FILTERS } =
  parseInitialState();

// ── Data loading ───────────────────────────────────────────────────────────────

const patternCache: Record<string, FilePattern[] | Promise<FilePattern[]>> = {};

async function loadFamily(family: string): Promise<FilePattern[]> {
  const cached = patternCache[family];
  if (cached instanceof Promise) return cached;
  if (cached !== undefined) return cached;

  const promise = fetch(`data/${family}.json`)
    .then((r) => (r.ok ? r.json() : []) as Promise<FilePattern[]>)
    .catch(() => [] as FilePattern[])
    .then((data) => {
      patternCache[family] = data;
      return data;
    });
  patternCache[family] = promise;
  return promise;
}

async function loadPatterns(filters: FilterState): Promise<Pattern[]> {
  const families = Array.from(filters.family);
  const datasets = await Promise.all(families.map(loadFamily));

  const pool: Pattern[] = [];
  families.forEach((family, i) => {
    for (const p of datasets[i]) {
      if (!filters.balls.has(String(p.balls))) continue;
      if (!filters.state.has(p.state)) continue;
      if (!filters.cycles.has(String(p.cycles))) continue;
      pool.push(toPattern(p, family));
    }
  });
  return pool;
}

function toPattern(p: FilePattern, family: string): Pattern {
  return {
    ...p,
    family,
    id: `${family}-${p.balls}b-${p.state}-${p.cycles}c-${p.halved.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`,
  };
}

// ── Display helpers ────────────────────────────────────────────────────────────

// Builds the family key used for FAMILY_LABEL lookups and beat-cycle splitting
function displayFamily(p: Pattern): string {
  return p.cycles > 1 ? `${p.family}_2cycle` : p.family;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activePattern, setActivePattern] = useState<Pattern | null>(null);
  const [filters, setFilters] = useState<FilterState>(INIT_FILTERS);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  async function generateWithFilters(f: FilterState) {
    setGenerating(true);
    setGenerateError("");
    try {
      const pool = await loadPatterns(f);
      if (pool.length === 0) {
        setGenerateError("No patterns match current filters");
        return;
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      setActivePattern(picked);
      history.replaceState(null, "", buildUrl(picked, f));
    } catch {
      setGenerateError("Failed to load patterns");
    } finally {
      setGenerating(false);
    }
  }

  async function loadFromUrl(up: UrlPattern, f: FilterState) {
    try {
      const data = await loadFamily(up.family);
      const found = data.find(
        (p) =>
          p.halved === up.halved &&
          p.balls === up.balls &&
          p.state === up.state &&
          p.cycles === up.cycles,
      );
      if (found) {
        setActivePattern(toPattern(found, up.family));
        // URL already has correct params
      } else {
        generateWithFilters(f);
      }
    } catch {
      generateWithFilters(f);
    }
  }

  // On mount: restore from URL or auto-generate
  useEffect(() => {
    if (INIT_PATTERN) {
      loadFromUrl(INIT_PATTERN, INIT_FILTERS);
    } else {
      generateWithFilters(INIT_FILTERS);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectPreset = useCallback(
    (familyId: string) => {
      const next = { ...filters, family: new Set([familyId]) };
      setFilters(next);
      setGenerateError("");
      generateWithFilters(next);
    },
    [filters],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  function handleGenerate() {
    generateWithFilters(filters);
  }

  const notationBeats = activePattern
    ? toNotationBeats(activePattern.beats, activePattern.rhythm)
    : undefined;

  const activeFamilyId =
    filters.family.size === 1 ? Array.from(filters.family)[0] : null;

  return (
    <div className="app">
      <nav className="app__nav">
        <b>Polymorphic Siteswaps</b>
      </nav>

      <PatternHero
        activePattern={activePattern}
        generatedUrl={
          activePattern
            ? buildJugglingLabUrl(
                activePattern.simplified,
                displayFamily(activePattern),
                activePattern.balls,
              )
            : undefined
        }
      />

      {activePattern && (
        <div className="app__section">
          <NotationDisplay
            halved={activePattern.halved}
            simplified={activePattern.simplified}
            notationBeats={notationBeats}
            family={displayFamily(activePattern)}
            balls={activePattern.balls}
            state={activePattern.state}
          />
        </div>
      )}

      <div className="app__generator">
        <h2 className="app__section-heading">Build a pattern</h2>
        <FilterPanel filters={filters} onChange={setFilters} />
        <button
          className="app__generate-btn"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? "Loading…" : generateError || "Generate"}
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
