import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "@/framework";

describe("Checkbox", () => {
  it("renders with a label", () => {
    render(<Checkbox label="Accept" name="accept" />);
    expect(screen.getByLabelText("Accept")).toBeInTheDocument();
  });

  it("reflects the checked prop", () => {
    render(<Checkbox label="On" name="on" checked readOnly />);
    expect(screen.getByLabelText("On")).toBeChecked();
  });

  it("calls onChange when toggled", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Toggle" name="toggle" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Toggle"));
    expect(onChange).toHaveBeenCalled();
  });
});
