import { runGenerator } from "./generator";
import type { Pattern, GeneratorParams } from "../types";

/**
 * Run the siteswap DFS generator synchronously.
 *
 * Designed to run inside a Web Worker (synchronous DFS on a dedicated
 * thread does not block the UI). Also callable directly in tests with
 * no Worker harness.
 *
 * @param params    - GeneratorParams including rhythm, balls, cycles, limits, mode, family
 * @param onPattern - Called immediately for each found pattern
 * @param abortRef  - Set abortRef.aborted = true to stop mid-run
 */
export function generatePatterns(
  params: GeneratorParams,
  onPattern: (pattern: Pattern) => void,
  abortRef: { aborted: boolean },
): void {
  runGenerator(params, onPattern, abortRef);
}

export type { GeneratorParams } from "../types";
