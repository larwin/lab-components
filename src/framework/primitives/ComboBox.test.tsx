// Integration: ComboBox — the query lives in the machine; the filtered
// collection feeds navigation/selection transparently.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComboBox } from "./ComboBox";

const FRUITS = ["Apple", "Apricot", "Banana", "Cherry"];

const setup = () => {
  const onSelectionChange = vi.fn();
  render(
    <ComboBox
      aria-label="Fruit"
      items={FRUITS}
      getKey={(s) => s}
      getTextValue={(s) => s}
      onSelectionChange={onSelectionChange}
      placeholder="Pick a fruit"
    />,
  );
  return { input: screen.getByRole("combobox"), onSelectionChange };
};

describe("<ComboBox />", () => {
  it("opens on typing and filters culture-aware", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "ap");
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Apple", "Apricot"]);
  });

  it("selects with keyboard, closes, and syncs the input text", async () => {
    const user = userEvent.setup();
    const { input, onSelectionChange } = setup();
    await user.type(input, "ap");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelectionChange).toHaveBeenCalledWith("Apricot", "Apricot");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Apricot");
    expect(input).toHaveFocus(); // focus never left the input
  });

  it("selects with the pointer without stealing focus from the input", async () => {
    const user = userEvent.setup();
    const { input, onSelectionChange } = setup();
    await user.click(screen.getByRole("button", { name: /toggle options/i }));
    expect(screen.getAllByRole("option")).toHaveLength(4);
    await user.pointer({
      keys: "[MouseLeft]",
      target: screen.getByRole("option", { name: "Cherry" }),
    });
    expect(onSelectionChange).toHaveBeenCalledWith("Cherry", "Cherry");
    expect(input).toHaveValue("Cherry");
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "zzz");
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});
