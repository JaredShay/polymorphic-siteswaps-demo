import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RhythmSelector from "./RhythmSelector";
import type { RhythmSelection } from "./RhythmSelector";
import { RHYTHM_PRESETS } from "../../data/rhythmPresets";

describe("RhythmSelector preset icons", () => {
  it("renders 7 preset buttons and 1 custom button", () => {
    render(<RhythmSelector onChange={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(8);
  });

  it("does not call onChange on initial render", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onChange when a second preset is toggled on", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("4 over 3"));
    const call = onChange.mock.calls.at(-1)![0] as RhythmSelection;
    expect(call.type).toBe("presets");
    expect(
      (call as { type: "presets"; families: string[] }).families,
    ).toContain("4over3");
    expect(
      (call as { type: "presets"; families: string[] }).families,
    ).toContain("3over2");
  });

  it("does not deselect the last active preset", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    // 3over2 is the sole selected preset — clicking it must not fire onChange
    fireEvent.click(screen.getByLabelText("3 over 2"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders the custom button", () => {
    render(<RhythmSelector onChange={() => {}} />);
    expect(screen.getByLabelText("Custom rhythm")).toBeInTheDocument();
  });
});

describe("Custom mode", () => {
  it("disables all preset buttons when custom is active", () => {
    render(<RhythmSelector onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    RHYTHM_PRESETS.forEach((p) => {
      expect(
        screen.getByLabelText(p.label.replace(" : ", " over ")),
      ).toBeDisabled();
    });
  });

  it("emits a custom rhythm when custom is activated", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    const call = onChange.mock.calls.at(-1)![0] as RhythmSelection;
    expect(call.type).toBe("custom");
    expect(
      (call as { type: "custom"; rhythm: { n: number } }).rhythm.n,
    ).toBeGreaterThan(0);
  });

  it("shows the custom config panel when custom is active", () => {
    render(<RhythmSelector onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    expect(screen.getByLabelText("Left hand length")).toBeInTheDocument();
    expect(screen.getByLabelText("Right hand length")).toBeInTheDocument();
  });

  it("does not deselect the last beat in a hand", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    const callsBefore = onChange.mock.calls.length;
    // Default leftBeats = {0} — clicking slot 0 must not change state
    fireEvent.click(screen.getByLabelText("Left beat 0"));
    expect(onChange.mock.calls.length).toBe(callsBefore);
  });

  it("extends beat grid when left length increases", () => {
    render(<RhythmSelector onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    // default leftLength = 2
    fireEvent.click(screen.getByLabelText("Increase left length"));
    // now leftLength = 3; expect 3 left beat slots
    expect(screen.getAllByLabelText(/^Left beat \d+$/)).toHaveLength(3);
  });

  it("selecting a preset while custom is active deactivates custom", () => {
    const onChange = vi.fn();
    render(<RhythmSelector onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Custom rhythm"));
    fireEvent.click(screen.getByLabelText("3 over 2")); // re-enable presets
    const call = onChange.mock.calls.at(-1)![0] as RhythmSelection;
    expect(call.type).toBe("presets");
  });
});
