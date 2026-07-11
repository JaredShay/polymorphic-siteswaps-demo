# Polyrhythmic Siteswap Generator — Design Notes

## Core Concept

We generate siteswap patterns where each hand operates at an independent rhythm — for example, the right hand throws 3 times for every 2 throws of the left hand (3-over-2). The pattern period is the LCM of the two rhythms, with each hand's throw beats distributed evenly across the cycle. Crosses between the two rhythmic layers are what make these genuinely polyrhythmic rather than two independent patterns layered together.

## Tempo and Functional Values

Because the pattern period is expanded (e.g., 6 beats for 3-over-2, 12 for 4-over-3), the patterns are played at an increased tempo to feel like comfortable juggling. A 3-over-2 pattern's 6 beats happen in the time a juggler would normally complete 2-3 throws. This tempo increase has consequences for which throws are physically practical.

## Functional Minimum (the "zip" threshold)

Each polyrhythm has a **functional minimum** — the smallest throw that covers one beat-spacing of the faster hand. This is calculated as:

```
min_cross_value = 2 * min(left_beat_spacing, right_beat_spacing)
```

| Polyrhythm | Faster hand spacing | Functional minimum |
|---|---|---|
| 3 / 2 | 2 (R every 2 beats) | 4 |
| 4 / 3 | 3 (R every 3 beats) | 6 |
| 5 / 2 | 2 (R every 2 beats) | 4 |
| 5 / 3 | 3 (R every 3 beats) | 6 |
| 5 / 4 | 4 (R every 4 beats) | 8 |

Throws at or below the functional minimum are **zips** — the polyrhythmic equivalent of a 1 in vanilla siteswap or 2x in standard sync. At the sped-up tempo, they happen so fast that they function like quick hand-to-hand passes.

## Zip Crossing Rules

When a zip cross occurs (any cross with value <= functional minimum):

1. **Direct zip**: If the zip lands on an active beat of the opposite hand, it is valid as-is. No special treatment needed.

2. **Intermediate zip**: If the zip lands on a non-active beat, the object is held in the catching hand until the next active beat. This hold is represented as a throw value bridging the gap (e.g., a hold of 4 means "wait 2 beats then throw").

3. **Transit constraint**: The catching hand must have NO active beats between when the zip is thrown and when it lands. At the increased tempo, a zip arrives too quickly for the catching hand to also be throwing mid-transit. This is checked by `catching_hand_busy_during_transit?`.

## What Is NOT a Zip

Crosses with values ABOVE the functional minimum are normal-speed throws. They:

- Do NOT get the intermediate hold treatment (they must land directly on an active beat)
- Do NOT need the transit check (the flight time is long enough for the catching hand to throw during transit — this is normal juggling, like a high throw where the other hand continues its rhythm)

## Example: 4-over-3

- Functional minimum = 6
- A `4x` is a zip (below 6) — can use intermediate hold, needs transit check
- A `6x` is at the boundary — still a zip, same treatment
- An `8x` is a normal cross — must land directly on an active beat, no intermediate hold

## Relationship to Throw Sets

For larger polyrhythms, sub-functional throw values (values below the functional minimum that aren't 0) create excessive branching without producing meaningful patterns. They are excluded from the throw set in `generate_data.rb`:

- 5-over-3: throws start at 6 (no 2, 4)
- 5-over-4: throws start at 6 (no 2, 4)
