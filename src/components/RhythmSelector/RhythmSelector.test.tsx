import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RhythmSelector from "./RhythmSelector";
import type { RhythmSelection } from "./RhythmSelector";

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
    expect((call as { type: "presets"; families: string[] }).families).toContain("4over3");
    expect((call as { type: "presets"; families: string[] }).families).toContain("3over2");
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
