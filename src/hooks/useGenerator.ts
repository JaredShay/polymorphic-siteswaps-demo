import { useState, useRef, useEffect, useCallback } from "react";
import type {
  Pattern,
  GeneratorParams,
  FilterState,
  GenerationSession,
} from "../types";
import type {
  WorkerOutMessage,
  WorkerInMessage,
} from "../workers/generator.worker";

const STORAGE_KEY = "poly-history";
const MAX_SESSIONS = 20;

// Serialize FilterState: Sets → string arrays
function serializeSession(s: GenerationSession): object {
  return {
    ...s,
    filters: {
      balls: Array.from(s.filters.balls),
      family: Array.from(s.filters.family),
      state: Array.from(s.filters.state),
      cycles: Array.from(s.filters.cycles),
    },
  };
}

// Deserialize FilterState: string arrays → Sets
function deserializeSession(raw: Record<string, unknown>): GenerationSession {
  const f = raw.filters as Record<string, string[]>;
  return {
    ...(raw as Omit<GenerationSession, "filters">),
    filters: {
      balls: new Set(f.balls ?? []),
      family: new Set(f.family ?? []),
      state: new Set(f.state ?? []),
      cycles: new Set(f.cycles ?? []),
    },
  };
}

function loadSessions(): GenerationSession[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return (raw as Record<string, unknown>[]).map(deserializeSession);
  } catch {
    return [];
  }
}

function saveSessions(sessions: GenerationSession[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sessions.slice(0, MAX_SESSIONS).map(serializeSession)),
    );
  } catch {
    // localStorage unavailable — silently skip
  }
}

export type GeneratorStatus = "idle" | "generating" | "done" | "error";

export type UseGeneratorReturn = {
  sessions: GenerationSession[];
  viewIndex: number;
  primaryIndex: number;
  status: GeneratorStatus;
  generate: (
    params: GeneratorParams,
    filters: FilterState,
    family: string,
  ) => void;
  setViewIndex: (index: number) => void;
  setPrimaryIndex: (index: number) => void;
};

export function useGenerator(): UseGeneratorReturn {
  const [sessions, setSessions] = useState<GenerationSession[]>(() =>
    loadSessions(),
  );
  const [viewIndex, setViewIndex] = useState(0);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [status, setStatus] = useState<GeneratorStatus>("idle");

  const workerRef = useRef<Worker | null>(null);
  const currentSessionRef = useRef<GenerationSession | null>(null);

  // Create worker once
  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../workers/generator.worker.ts", import.meta.url),
      { type: "module" },
    );

    workerRef.current.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;

      if (msg.type === "pattern") {
        if (!currentSessionRef.current) return;
        currentSessionRef.current = {
          ...currentSessionRef.current,
          patterns: [...currentSessionRef.current.patterns, msg.pattern],
        };
        setSessions((prev) => {
          const next = [...prev];
          next[0] = currentSessionRef.current!;
          return next;
        });
      }

      if (msg.type === "done") {
        if (currentSessionRef.current) {
          setSessions((prev) => {
            const next = [...prev];
            next[0] = currentSessionRef.current!;
            saveSessions(next);
            return next;
          });
        }
        setStatus("done");
      }

      if (msg.type === "error") {
        setStatus("error");
      }
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const generate = useCallback(
    (params: GeneratorParams, filters: FilterState, family: string) => {
      // Cancel any in-progress run
      workerRef.current?.postMessage({
        type: "cancel",
      } satisfies WorkerInMessage);

      const session: GenerationSession = {
        id: String(Date.now()),
        timestamp: Date.now(),
        params,
        filters,
        patterns: [],
      };
      currentSessionRef.current = session;

      setSessions((prev) => [session, ...prev].slice(0, MAX_SESSIONS));
      setViewIndex(0);
      setPrimaryIndex(0);
      setStatus("generating");

      workerRef.current?.postMessage({
        type: "start",
        params,
        family,
      } satisfies WorkerInMessage);
    },
    [],
  );

  return {
    sessions,
    viewIndex,
    primaryIndex,
    status,
    generate,
    setViewIndex,
    setPrimaryIndex,
  };
}
