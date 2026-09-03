# Rhythm Selector Redesign

**Date:** 2026-09-03
**Branch:** worktree-ts-generator
**Status:** Approved, ready for implementation

## Summary

Replace the duplicative rhythm chip row (FilterPanel) and PresetsGrid with a unified `RhythmSelector` component that uses visual icons and adds a custom rhythm builder.

## Motivation

- The rhythm filter chips in FilterPanel and the PresetsGrid icons both select rhythms — one as text chips (multi-select), one as visual cards (single-select). They are redundant.
- The PresetsGrid visual is better but limited to single-select and lives separately from other filters.
- Users need a way to define arbitrary polyrhythms beyond the 7 presets.

## Design

### New Component: RhythmSelector

A self-contained component that owns all rhythm selection state and emits a typed selection upward.

**Output type:**

```typescript
type RhythmSelection =
  | { type: "presets"; families: string[] }  // one or more preset ids, multi-select
  | { type: "custom"; rhythm: Rhythm }        // fully custom-defined rhythm
```

**Internal state:**

```typescript
{
  selectedFamilies: Set<string>   // which preset icons are toggled
  customActive: boolean           // whether custom mode is active
  customConfig: {
    leftLength: number            // 2–8
    rightLength: number           // 2–8
    leftBeats: Set<number>        // indices into left hand's slots
    rightBeats: Set<number>       // indices into right hand's slots
  }
}
```

### Preset Icons

The 7 existing rhythm presets are displayed as compact icon buttons (~80px square) in a wrapping flex row. Each reuses the existing `RhythmIcon` SVG with two changes:

1. The numeric ratio (e.g., "3:2") rendered as a `<text>` element centered inside the SVG circle, replacing the `<span>` name below.
2. Accepts a `size` prop for the smaller format.

Multi-select toggle behavior: clicking a preset toggles it on/off. At least one must remain selected (same guard as existing chip toggle). When custom mode is active, preset icons are greyed out (opacity ~0.35, non-interactive).

### Custom Icon

An 8th icon button in the same row, visually distinct: dashed ring with a `+` center. Selecting it:
- Sets `customActive = true`
- Greys out all preset icon buttons
- Expands the custom configuration panel inline below the icon row

Selecting any preset icon when custom is active deactivates custom mode and re-enables presets.

### Custom Configuration Panel (inline expansion)

Appears below the icon row when custom is active:

```
Left   [−] 4 [+]   [ ][ ][■][■][ ][ ][ ][ ]
Right  [−] 3 [+]   [■][ ][■][ ][■][ ]
```

- **Length stepper** per hand: +/− buttons, range 2–8. When length changes, the beat grid truncates or extends (existing selections preserved where possible).
- **Beat grid**: one small toggle square per slot, 0-indexed from left. At least one beat must remain active per hand.
- Speed and throw set are derived by the generator from the rhythm — no user input needed.

**Period computation:** `n = lcm(leftLength, rightLength)`. Each active slot index `s` in a hand's beat set maps to a position in the shared period:

```
left slot s  → s * (n / leftLength)
right slot s → s * (n / rightLength)
```

For example: leftLength=4, leftBeats={0,2}, n=12 → period positions {0, 6}.

### FilterState Change

`family` is removed from `FilterState` — rhythm selection is now fully owned by `RhythmSelector`.

```typescript
type FilterState = {
  balls: Set<string>;
  state: Set<string>;
  cycles: Set<string>;
  // family removed
}
```

### App.tsx Integration

- `RhythmSelector` replaces both the Rhythm row in FilterPanel and the PresetsGrid below.
- `handleSelectPreset` removed.
- `filtersToParamSets` updated to accept `RhythmSelection` alongside `FilterState`:
  - For `type: "presets"`: same logic as today, looks up each family id in `RHYTHM_PRESETS`.
  - For `type: "custom"`: computes `n = lcm(...)`, constructs `Rhythm` directly, uses `family: "custom"` in `GeneratorParams`.
- `RhythmSelector` receives an `onChange` prop; App triggers generation on each change (same as current preset-select behavior).

## Files

### New
- `src/components/RhythmSelector/RhythmSelector.tsx`
- `src/components/RhythmSelector/RhythmSelector.css`
- `src/utils/math.ts` — `lcm(a, b)` utility

### Modified
- `src/types.ts` — remove `family` from `FilterState`
- `src/App.tsx` — remove PresetsGrid, handleSelectPreset; wire RhythmSelector; update filtersToParamSets
- `src/components/FilterPanel/FilterPanel.tsx` — remove Rhythm row
- `src/components/FilterPanel/FilterPanel.css` — minor cleanup if needed
- `src/components/RhythmIcon/RhythmIcon.tsx` — centered text overlay; size prop

### Deleted
- `src/components/PresetsGrid/PresetsGrid.tsx`
- `src/components/PresetsGrid/PresetsGrid.css`

## Testing

- `lcm` utility: unit tests including co-prime inputs, equal inputs, one divides the other
- Beat-to-period mapping: unit tests for edge cases (single beat per hand, co-prime lengths)
- `RhythmSelector`:
  - Preset multi-select toggle and minimum-one guard
  - Activating custom greys out presets
  - Beat grid toggle guard (at least one active per hand)
  - Length stepper truncates/extends beat grid correctly
