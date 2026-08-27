import { useState, useCallback } from "react";
import type { Pattern, FilterState } from "./types";
import { toNotationBeats } from "./utils/beats";
import { MOCK_PATTERNS } from "./data/mockPatterns";
import PatternHero from "./components/PatternHero/PatternHero";
import NotationDisplay from "./components/NotationDisplay/NotationDisplay";
import FilterPanel from "./components/FilterPanel/FilterPanel";
import PresetsGrid from "./components/PresetsGrid/PresetsGrid";
import { buildJugglingLabUrl } from "./utils/jugglinglab";
import "./App.css";

const TWO_CYCLE_FAMILIES = new Set(["3over2", "4over3", "332"]);

type JsonPattern = { halved: string; simplified: string };

type GeneratedState = {
  halved: string;
  simplified: string;
  balls: number;
  family: string;
  state: string;
};

const patternCache: Record<string, JsonPattern[] | Promise<JsonPattern[]>> = {};

function dataKey(balls: string, family: string, state: string) {
  return `data/${balls}b_${family}_${state}.json`;
}

function patternToFilters(p: Pattern): FilterState {
  const isTwo = p.family.endsWith('_2cycle');
  return {
    balls:  new Set([String(p.balls)]),
    family: new Set([p.family.replace(/_2cycle$/, '')]),
    state:  new Set([p.state]),
    cycles: new Set([isTwo ? '2' : '1']),
  };
}

async function loadPatterns(filters: FilterState): Promise<GeneratedState[]> {
  const keys: { key: string; balls: number; family: string; state: string }[] = [];
  for (const b of filters.balls) {
    for (const family of filters.family) {
      for (const s of filters.state) {
        if (filters.cycles.has("1")) {
          keys.push({ key: dataKey(b, family, s), balls: parseInt(b), family, state: s });
        }
        if (filters.cycles.has("2") && TWO_CYCLE_FAMILIES.has(family)) {
          const f2 = family + "_2cycle";
          keys.push({ key: dataKey(b, f2, s), balls: parseInt(b), family: f2, state: s });
        }
      }
    }
  }

  await Promise.all(
    keys
      .filter(({ key }) => patternCache[key] === undefined)
      .map(({ key }) => {
        const promise = fetch(key)
          .then(r => r.ok ? r.json() as Promise<JsonPattern[]> : [])
          .catch(() => [] as JsonPattern[])
          .then(data => { patternCache[key] = data; return data; });
        patternCache[key] = promise;
        return promise;
      })
  );

  const pool: GeneratedState[] = [];
  for (const { key, balls, family, state } of keys) {
    const cached = patternCache[key];
    const patterns: JsonPattern[] = cached instanceof Promise ? [] : cached ?? [];
    for (const p of patterns) {
      pool.push({ halved: p.halved, simplified: p.simplified, balls, family, state });
    }
  }
  return pool;
}

export default function App() {
  const [activePattern, setActivePattern] = useState<Pattern | null>(MOCK_PATTERNS[0]);
  const [generated, setGenerated] = useState<GeneratedState | null>(null);
  const [filters, setFilters] = useState<FilterState>(() => patternToFilters(MOCK_PATTERNS[0]));
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const handleSelectPreset = useCallback((p: Pattern) => {
    setActivePattern(p);
    setGenerated(null);
    setGenerateError("");
    setFilters(patternToFilters(p));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError("");
    try {
      const pool = await loadPatterns(filters);
      if (pool.length === 0) {
        setGenerateError("No patterns match current filters");
        return;
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      setGenerated(picked);
      setActivePattern(null);
    } catch {
      setGenerateError("Failed to load patterns");
    } finally {
      setGenerating(false);
    }
  }

  const displayHalved    = activePattern ? activePattern.halved    : generated?.halved ?? "";
  const displaySimplified = activePattern ? activePattern.simplified : generated?.simplified ?? "";
  const displayFamily    = activePattern ? activePattern.family    : generated?.family ?? "";
  const displayBalls     = activePattern ? activePattern.balls     : generated?.balls ?? 0;
  const displayState     = activePattern ? activePattern.state     : generated?.state ?? "";
  const notationBeats = activePattern
    ? toNotationBeats(activePattern.beats, activePattern.rhythm)
    : undefined;

  const generatedUrl = generated
    ? buildJugglingLabUrl(generated.simplified, generated.family, generated.balls)
    : undefined;

  return (
    <div className="app">
      <nav className="app__nav">
        <b>Polymorphic Siteswaps</b>
      </nav>

      <PatternHero activePattern={activePattern} generatedUrl={generatedUrl} />

      {(displayHalved || displaySimplified) && (
        <div className="app__section">
          <NotationDisplay
            halved={displayHalved}
            simplified={displaySimplified}
            notationBeats={notationBeats}
            family={displayFamily}
            balls={displayBalls}
            state={displayState}
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
        patterns={MOCK_PATTERNS}
        activeId={activePattern?.id ?? null}
        onSelect={handleSelectPreset}
      />

      <footer>
        <span>designed by j.swaps · MIT License</span>
      </footer>
    </div>
  );
}
