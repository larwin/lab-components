// Integration: Menu primitive over the Overlay engine (portal, dismissal,
// focus restore) driven by the pure menu machine.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "./Menu";

const sections = [
  {
    label: "Edit",
    items: [
      { key: "copy", label: "Copy", shortcut: "Mod+C" },
      { key: "paste", label: "Paste", disabled: true },
    ],
  },
  {
    items: [{ key: "delete", label: "Delete", destructive: true }],
  },
];

describe("<Menu />", () => {
  it("opens from the trigger and renders menu items in a portal", async () => {
    const user = userEvent.setup();
    render(<Menu label="Options" sections={sections} onAction={vi.fn()} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /options/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  it("navigates with arrows (skipping disabled) and activates with Enter", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { container } = render(<Menu label="Options" sections={sections} onAction={onAction} />);
    const trigger = screen.getByRole("button", { name: /options/i });
    trigger.focus();
    await user.keyboard("{ArrowDown}"); // opens + focuses Copy
    const menu = screen.getByRole("menu");
    expect(menu).toHaveFocus();
    await user.keyboard("{ArrowDown}"); // Paste is disabled → Delete
    const deleteItem = screen.getByRole("menuitem", { name: "Delete" });
    expect(menu).toHaveAttribute("aria-activedescendant", deleteItem.id);
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith("delete");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // Focus restored to the trigger after closing.
    expect(container.contains(document.activeElement)).toBe(true);
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape without firing an action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Menu label="Options" sections={sections} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: /options/i }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onAction).not.toHaveBeenCalled();
  });
});
