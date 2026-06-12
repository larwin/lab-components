// Integration: the React adapter wired to the pure listbox machine.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Listbox } from "./Listbox";

const items = ["Alpha", "Bravo", "Charlie", "Delta"];

const setup = (props: Partial<React.ComponentProps<typeof Listbox<string>>> = {}) => {
  const onSelectionChange = vi.fn();
  render(
    <Listbox
      aria-label="Fruits"
      items={items}
      getKey={(s) => s}
      getTextValue={(s) => s}
      onSelectionChange={onSelectionChange}
      {...props}
    />,
  );
  return { listbox: screen.getByRole("listbox"), onSelectionChange };
};

describe("<Listbox />", () => {
  it("renders options with ARIA wiring", () => {
    setup();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.getByRole("listbox")).toHaveAccessibleName("Fruits");
  });

  it("navigates with aria-activedescendant — host keeps DOM focus", async () => {
    const user = userEvent.setup();
    const { listbox } = setup();
    await user.tab();
    expect(listbox).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    const bravo = screen.getByRole("option", { name: "Bravo" });
    expect(listbox).toHaveAttribute("aria-activedescendant", bravo.id);
    expect(listbox).toHaveFocus(); // focus never left the host
  });

  it("selects the focused option with Enter and reports the change", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = setup();
    await user.tab();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["Alpha"]));
  });

  it("supports typeahead", async () => {
    const user = userEvent.setup();
    const { listbox } = setup();
    await user.tab();
    await user.keyboard("d");
    const delta = screen.getByRole("option", { name: "Delta" });
    expect(listbox).toHaveAttribute("aria-activedescendant", delta.id);
  });

  it("selects with the pointer, range-extends with Shift", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = setup({ selectionMode: "multiple" });
    await user.pointer({
      keys: "[MouseLeft]",
      target: screen.getByRole("option", { name: "Bravo" }),
    });
    await user.keyboard("{Shift>}");
    await user.pointer({
      keys: "[MouseLeft]",
      target: screen.getByRole("option", { name: "Delta" }),
    });
    await user.keyboard("{/Shift}");
    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(["Bravo", "Charlie", "Delta"]));
  });
});
