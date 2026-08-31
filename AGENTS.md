# Polyrhythmic Siteswap Generator — Design Notes

## Architecture

This is a **static site**. The Ruby backend runs offline and writes JSON files to `data/`. The React frontend fetches these files directly; there is no runtime API.

### Stack
- **Generator** (`lib/siteswap/`): Ruby, run via `generate_data.rb` → `data/*.json`
- **Frontend** (`src/`): React + TypeScript
- **Deploy**: build frontend, push to GitHub; the deploy workflow publishes it

### Backend modules
- **Generator** (`generator.rb`): DFS search producing raw beat arrays
- **Transforms** (`transforms.rb`): composable post-processing (Halve, CancelPairs, Expand) — display only, not core to generation
- **Formatters** (`formatter.rb`): convert raw beat arrays to strings or structured beat data for the JSON schema
- **Specs** (`specs.rb`): beat layouts (period, left_beats, right_beats) per polyrhythm family
- **Notation** (`notation.rb`): Dry::Struct types for the internal beat representation

---

## Critical: this is not conventional siteswap

**Siteswap values are activation counts, not throw heights.** A value of N means the ball must be thrown again N time-slots later. Physical height is a consequence of tempo; siteswap specifies only timing relationships.

These patterns are **polyrhythmic**: each hand operates at an independent rhythm.

---

## The LCM Grid and Tempo Scaling

To represent a polyrhythm in siteswap, the period must equal the LCM of the two hand rhythms (e.g. 6 for 3-over-2). This shared grid is fine enough to place both hands' beats.

Two consequences follow:

**1. Throw values are larger than in standard patterns** for the same ball count — the grid has more slots per cycle, not because balls are thrown higher.

**2. The tempo must scale up** proportionally so the pattern feels like comfortable juggling. This is relevant for animators and physical-realizability reasoning.

Neither fact changes mathematical validity.

---

## The Throw Floor and Zips

At the scaled-up tempo, cross throws with small values arrive at the other hand very quickly. The **functional minimum** for a cross throw is the smallest value that spans one beat-spacing of the catching hand:

```
functional_minimum = 2 × catching_hand_spacing
```

Cross throws at or below this floor are **zips** — quick hand-to-hand passes equivalent to a `2x` in standard sync siteswap. They look like routine mid-height throws in the halved display output, but at polyrhythmic tempo they are fast zips.

Example (illustrative, not exhaustive): in a rhythm where the catching hand fires every 2 grid beats, the functional minimum is 4. A `4x` in halved output is a zip; an `8x` is a normal cross with flight time long enough for standard juggling dynamics.

### Why small throws are filtered in `generate_data.rb`

For rhythms where the catching hand has large spacing, throws below the floor produce almost no valid patterns (they rarely land on an active beat) and generate excessive search branching. These values are often excluded from the throw set per rhythm via configuration. The threshold for each rhythm is derived from the formula above — check `generate_data.rb` for current values, as these change when rhythms are added or throw sets are tuned.

We do **not** filter for subjective difficulty. If a value is mathematically valid and lands on an active beat, it is included. The floor is specifically about structural impossibility at the required tempo, not physical difficulty in isolation.

---

## The Generator

The generator (`generator.rb`) uses a DFS holes-based algorithm (JugglingLab-style). It operates on a grid of `(beat, hand)` slots and assigns throw values via backtracking.

All throw values **must be even** — a convention of the LCM-expanded grid, not a physical constraint.

### Landing constraint

**Every throw must land directly on an active beat of the target hand.** There is no intermediate hold. The holes model enforces this at the innermost loop:

```ruby
next if holes[lb][lh].zero?
```

A throw value V from beat B is rejected if `(B + V/2) % period` is not an active beat of the target hand.

An earlier version allowed zips to land on non-active beats and be held until the next active beat. This was removed: a value held for extra beats is mathematically identical to a larger direct throw landing on that beat. Intermediate holds added no new patterns.

### Why this implicitly enforces the zip constraint

For evenly-spaced rhythms, the holes model alone guarantees zip throws never require an intermediate catch — no explicit transit check is needed.

**Proof:** Define a zip as a cross throw with value V ≤ functional_minimum = 2 × catching_hand_spacing. A zip from beat B lands at L = (B + V/2) % period. Since the holes model accepted it, L is an active catching-hand beat. The previous catching-hand beat before L is at L − spacing, where spacing ≥ catching_hand_spacing ≥ V/2. Therefore the previous catching-hand beat ≤ L − V/2 = B. No catching-hand beat falls in the open transit interval (B, L). ∎

Concrete check (illustrative — 3-over-2, left spacing = 3, functional_min = 4):
- Raw 4x from right at beat 4 → lands at (4+2)%6 = 0. Transit window: {5}. Left beats: {0,3}. No left beat in {5}. ✓
- Raw 2x from right at beat 2 → lands at (2+1)%6 = 3. Transit window: empty. ✓

This guarantee holds only for evenly-spaced rhythms where catching_hand_spacing is uniform. Non-uniform rhythms (e.g. 332) require per-direction analysis and may not hold for all throw values — those rhythms need more careful throw set design.

### Other generator constraints
- Patterns must have at least one cross throw (enforced in `add_result`)
- Mirror-symmetric patterns are deduplicated
- Results are classified as `ground` or `active` against the analytically computed ground state
- Multi-cycle patterns are pruned if they resolve to ground state before the full cycle count

---

## Tempo (BPS) Derivation

The JugglingLab URL `bps` parameter sets animation speed. The target is for each hand to throw at a natural pace (~2.5 throws/second).

### Formula

```
BPS = 2.5 × min(median_gap(left_hand), median_gap(right_hand))
```

Gaps are consecutive inter-beat intervals within each hand (including the wrap-around gap). For evenly-spaced rhythms, all gaps within a hand are equal, so median = `period / count`, and the formula reduces to `2.5 × denser_hand_spacing`.

For non-uniform rhythms, **median** gap is used rather than minimum. The minimum gap in rhythms like 332 or clave represents a short syncopated step — using it as the reference sets tempo too slow. The median captures the typical step size.

### Verification (current families — update when new rhythms are added)

| Family | Right gaps       | Median R | Left gaps     | Median L | min | BPS  |
|--------|-----------------|----------|---------------|----------|-----|------|
| 3/2    | [2,2,2]         | 2        | [3,3]         | 3        | 2   | 5    |
| 4/3    | [3,3,3,3]       | 3        | [4,4,4]       | 4        | 3   | 7.5  |
| 5/2    | [2,2,2,2,2]     | 2        | [5,5]         | 5        | 2   | 5    |
| 5/3    | [3,3,3,3,3]     | 3        | [5,5,5]       | 5        | 3   | 7.5  |
| 5/4    | [4,4,4,4,4]     | 4        | [5,5,5,5]     | 5        | 4   | 10   |
| 332    | [3,3,2]         | 3        | [4,4]         | 4        | 3   | 7.5  |
| clave  | [3,3,4,2,4]     | 3        | [4,4,4,4]     | 4        | 3   | 7.5  |

For new rhythms, compute BPS directly from the beat arrays in the spec using the formula above.

---

## Transforms and Formatting (display only)

Transforms and formatters are applied after generation. They do not affect which patterns are generated.

- **Halve**: divides all throw values by 2, producing notation closer to standard juggling conventions
- **CancelPairs**: collapses redundant suppressed empty beats
- **Expand**: converts single-hand sync beats to async notation for readability

### Presets
```
raw:     []
halved:  [Halve]
compact: [Halve, CancelPairs]
full:    [Halve, CancelPairs, Expand]
```

`SiteswapMultiFormatter` runs multiple preset pipelines and returns all representations in the JSON output (`halved`, `simplified`, `beats`).
