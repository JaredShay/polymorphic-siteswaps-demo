import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGenerator } from "./useGenerator";
import type { Pattern, GeneratorParams, FilterState } from "../types";
import { RHYTHM_PRESETS } from "../data/rhythmPresets";

// ── Mock Worker ───────────────────────────────────────────────────────────────

type MsgHandler = (e: MessageEvent) => void;

class MockWorker {
  onmessage: MsgHandler | null = null;
  private sentMessages: unknown[] = [];

  postMessage(msg: unknown) {
    this.sentMessages.push(msg);
    // Simulate async pattern emission on 'start'
    if ((msg as { type: string }).type === "start") {
      setTimeout(() => {
        this.onmessage?.({
          data: { type: "pattern", pattern: mockPattern },
        } as MessageEvent);
        this.onmessage?.({ data: { type: "done", total: 1 } } as MessageEvent);
      }, 0);
    }
  }

  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
  onerror = null;
  onmessageerror = null;
}

vi.stubGlobal("Worker", MockWorker);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const rhythm = RHYTHM_PRESETS.find((r) => r.id === "3over2")!.rhythm;

const mockPattern: Pattern = {
  id: "test-pattern",
  halved: "(4x,6)!(0,0)!(2x,4)!",
  simplified: "R4x6",
  balls: 4,
  state: "ground",
  family: "3over2",
  cycles: 1,
  length: 6,
  rhythm,
  beats: [],
};

const defaultParams: GeneratorParams = {
  rhythm,
  balls: 4,
  cycles: 1,
  groundLimit: 5,
  activeLimit: 5,
  mode: "sampled",
  family: "3over2",
};

const defaultFilters: FilterState = {
  balls: new Set(["4"]),
  family: new Set(["3over2"]),
  state: new Set(["ground", "active"]),
  cycles: new Set(["1"]),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useGenerator", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with idle status and no sessions", () => {
    const { result } = renderHook(() => useGenerator());
    expect(result.current.status).toBe("idle");
    expect(result.current.sessions).toHaveLength(0);
  });

  it("transitions to generating when generate is called", async () => {
    const { result } = renderHook(() => useGenerator());
    act(() => {
      result.current.generate([defaultParams], defaultFilters);
    });
    expect(result.current.status).toBe("generating");
  });

  it("appends a pattern when the Worker emits one", async () => {
    const { result } = renderHook(() => useGenerator());
    await act(async () => {
      result.current.generate([defaultParams], defaultFilters);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.sessions[0]?.patterns.length).toBeGreaterThan(0);
  });

  it("transitions to done when Worker emits done", async () => {
    const { result } = renderHook(() => useGenerator());
    await act(async () => {
      result.current.generate([defaultParams], defaultFilters);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.status).toBe("done");
  });

  it("saves session to localStorage on done", async () => {
    const { result } = renderHook(() => useGenerator());
    await act(async () => {
      result.current.generate([defaultParams], defaultFilters);
      await new Promise((r) => setTimeout(r, 10));
    });
    const stored = JSON.parse(localStorage.getItem("poly-history") ?? "[]");
    expect(stored).toHaveLength(1);
  });

  it("setViewIndex updates viewIndex", () => {
    const { result } = renderHook(() => useGenerator());
    act(() => {
      result.current.setViewIndex(0);
    });
    expect(result.current.viewIndex).toBe(0);
  });

  it("setPrimaryIndex updates primaryIndex", () => {
    const { result } = renderHook(() => useGenerator());
    act(() => {
      result.current.setPrimaryIndex(2);
    });
    expect(result.current.primaryIndex).toBe(2);
  });
});
