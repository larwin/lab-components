import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { List, type ListItem } from "@/framework";

const items: ListItem[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

describe("List", () => {
  it("renders all items as options", () => {
    render(<List items={items} />);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("marks the selected item", () => {
    render(<List items={items} selectedId="b" />);
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Beta");
  });

  it("calls onSelect when an item is clicked", async () => {
    const onSelect = vi.fn();
    render(<List items={items} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Gamma"));
    expect(onSelect).toHaveBeenCalledWith("c");
  });
});
