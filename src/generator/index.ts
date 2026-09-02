import { runGenerator } from "./generator";
import type { Pattern, GeneratorParams } from "../types";

/**
 * Run the siteswap DFS generator synchronously.
 *
 * Designed to run inside a Web Worker (synchronous DFS on a dedicated
 * thread does not block the UI). Also callable directly in tests with
 * no Worker harness.
 *
 * @param params    - GeneratorParams including rhythm, balls, cycles, limits
 * @param onPattern - Called immediately for each found pattern
 * @param abortRef  - Set abortRef.aborted = true to stop mid-run
 * @param family    - Rhythm family string (e.g. "3over2") used in pattern IDs
 */
export function generatePatterns(
  params: GeneratorParams,
  onPattern: (pattern: Pattern) => void,
  abortRef: { aborted: boolean },
  family = "unknown",
): void {
  runGenerator(params, onPattern, abortRef, family);
}

export type { GeneratorParams } from "../types";
