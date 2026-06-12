// @vitest-environment node
import { describe, expect, it } from "vitest";
import { partitionOverflow, type OverflowItem } from "./overflow";

const item = (key: string, width: number, priority = 0): OverflowItem => ({
  key,
  width,
  priority,
});
const sep = (key: string, width = 10): OverflowItem => ({ key, width, kind: "separator" });

describe("partitionOverflow", () => {
  it("keeps everything visible (no trigger) when the row fits", () => {
    const result = partitionOverflow({
      items: [item("a", 50), item("b", 50), item("c", 50)],
      availableWidth: 160,
      triggerWidth: 30,
      gap: 4,
    });
    expect(result).toEqual({
      visibleKeys: ["a", "b", "c"],
      overflowKeys: [],
      hasOverflow: false,
    });
  });

  it("counts gaps between children when checking the fit", () => {
    // 3 × 50 = 150 fits in 152 without gaps, but not with 2 × 4px gaps.
    const items = [item("a", 50), item("b", 50), item("c", 50)];
    expect(
      partitionOverflow({ items, availableWidth: 152, triggerWidth: 20, gap: 0 }).hasOverflow,
    ).toBe(false);
    expect(
      partitionOverflow({ items, availableWidth: 152, triggerWidth: 20, gap: 4 }).hasOverflow,
    ).toBe(true);
  });

  it("reserves the trigger width as soon as one item overflows", () => {
    // Row of 200 in 180: dropping "c" (60) leaves 140, but 140 + trigger 50
    // + gap = 194 > 180, so "b" must overflow too.
    const result = partitionOverflow({
      items: [item("a", 80), item("b", 60), item("c", 60)],
      availableWidth: 180,
      triggerWidth: 50,
      gap: 0,
    });
    expect(result.visibleKeys).toEqual(["a"]);
    expect(result.overflowKeys).toEqual(["b", "c"]);
    expect(result.hasOverflow).toBe(true);
  });

  it("evicts lowest priority first, ties from the right", () => {
    const result = partitionOverflow({
      items: [item("undo", 40, 0), item("bold", 40, 2), item("italic", 40, 2), item("link", 40, 1)],
      availableWidth: 130,
      triggerWidth: 30,
      gap: 0,
    });
    // undo (prio 0) leaves first, then link (prio 1): 80 + 30 = 110 ≤ 130.
    expect(result.visibleKeys).toEqual(["bold", "italic"]);
    expect(result.overflowKeys).toEqual(["undo", "link"]);
  });

  it("preserves document order in both partitions", () => {
    const result = partitionOverflow({
      items: [item("a", 60, 0), item("b", 60, 5), item("c", 60, 0), item("d", 60, 5)],
      availableWidth: 170,
      triggerWidth: 30,
      gap: 0,
    });
    // c then a evicted (prio 0, rightmost first) → visible b, d in order.
    expect(result.visibleKeys).toEqual(["b", "d"]);
    expect(result.overflowKeys).toEqual(["a", "c"]);
  });

  it("can overflow everything when nothing fits next to the trigger", () => {
    const result = partitionOverflow({
      items: [item("a", 200), item("b", 200)],
      availableWidth: 100,
      triggerWidth: 40,
      gap: 0,
    });
    expect(result.visibleKeys).toEqual([]);
    expect(result.overflowKeys).toEqual(["a", "b"]);
    expect(result.hasOverflow).toBe(true);
  });

  it("never sends separators to the menu and prunes dangling ones", () => {
    const result = partitionOverflow({
      items: [item("a", 50), sep("s1"), item("b", 50), sep("s2"), item("c", 50)],
      availableWidth: 130,
      triggerWidth: 30,
      gap: 0,
    });
    // c then b evicted → row would end "a, s1, [s2]" → both separators pruned
    // (s1 becomes trailing once b is gone).
    expect(result.visibleKeys).toEqual(["a"]);
    expect(result.overflowKeys).toEqual(["b", "c"]);
  });

  it("keeps interior separators that still split two visible items", () => {
    const result = partitionOverflow({
      items: [item("a", 50), sep("s1"), item("b", 50), sep("s2"), item("c", 50, -1)],
      availableWidth: 160,
      triggerWidth: 30,
      gap: 0,
    });
    // Only c (lowest priority) leaves: a | b … and s1 still separates a from b.
    expect(result.visibleKeys).toEqual(["a", "s1", "b"]);
    expect(result.overflowKeys).toEqual(["c"]);
  });

  it("pruning a dangling separator can free enough room to stop evicting", () => {
    // a(50) s(20) b(50) in 110: full row = 120 > 110. Evicting b prunes s,
    // leaving 50 + trigger 30 = 80 ≤ 110 — a single eviction suffices.
    const result = partitionOverflow({
      items: [item("a", 50), sep("s", 20), item("b", 50)],
      availableWidth: 110,
      triggerWidth: 30,
      gap: 0,
    });
    expect(result.visibleKeys).toEqual(["a"]);
    expect(result.overflowKeys).toEqual(["b"]);
  });
});
