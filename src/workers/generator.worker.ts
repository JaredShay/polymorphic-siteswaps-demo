import { generatePatterns } from "../generator";
import type { Pattern, GeneratorParams } from "../types";

// ── Message protocol ──────────────────────────────────────────────────────────

export type WorkerInMessage =
  { type: "start"; paramSets: GeneratorParams[] } | { type: "cancel" };

export type WorkerOutMessage =
  | { type: "pattern"; pattern: Pattern }
  | { type: "done"; total: number }
  | { type: "error"; message: string };

// ── Worker state ──────────────────────────────────────────────────────────────

const abortRef = { aborted: false };
let total = 0;

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === "cancel") {
    abortRef.aborted = true;
    return;
  }

  if (msg.type === "start") {
    abortRef.aborted = false;
    total = 0;

    try {
      for (const params of msg.paramSets) {
        if (abortRef.aborted) break;
        generatePatterns(
          params,
          (pattern: Pattern) => {
            total++;
            self.postMessage({
              type: "pattern",
              pattern,
            } satisfies WorkerOutMessage);
          },
          abortRef,
        );
      }
      self.postMessage({ type: "done", total } satisfies WorkerOutMessage);
    } catch (err) {
      self.postMessage({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      } satisfies WorkerOutMessage);
    }
  }
};
