// @vitest-environment node
// Pure core: windowing math tested without DOM. Includes a 500k-item check.
import { describe, expect, it } from "vitest";
import { createVirtualizer } from "./virtualizer";

describe("virtualizer (Fenwick-tree windowing)", () => {
  it("computes offsets and total size for fixed sizes", () => {
    const v = createVirtualizer({ count: 100, estimateSize: 40 });
    expect(v.totalSize()).toBe(4000);
    expect(v.offsetOf(0)).toBe(0);
    expect(v.offsetOf(10)).toBe(400);
    expect(v.indexAt(399)).toBe(9);
    expect(v.indexAt(400)).toBe(10);
  });

  it("returns the right window with overscan", () => {
    const v = createVirtualizer({ count: 1000, estimateSize: 40, overscan: 2 });
    const range = v.range(800, 200); // items 20..24 visible
    expect(range.startIndex).toBe(18);
    expect(range.endIndex).toBe(26);
    expect(range.items[0]).toMatchObject({ index: 18, start: 720, size: 40 });
    expect(range.items.at(-1)).toMatchObject({ index: 26 });
  });

  it("handles dynamic measurement and keeps offsets exact", () => {
    const v = createVirtualizer({ count: 10, estimateSize: 40, overscan: 0 });
    v.measure(2, 100); // item 2 grows by 60
    expect(v.totalSize()).toBe(9 * 40 + 100);
    expect(v.offsetOf(3)).toBe(80 + 100);
    expect(v.indexAt(120)).toBe(2);
    expect(v.indexAt(185)).toBe(3);
  });

  it("clamps ranges at both ends and supports empty collections", () => {
    const empty = createVirtualizer({ count: 0, estimateSize: 40 });
    expect(empty.range(0, 500).items).toHaveLength(0);
    const v = createVirtualizer({ count: 5, estimateSize: 40, overscan: 10 });
    const range = v.range(0, 1000);
    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(4);
  });

  it("computes scroll offsets for alignment (ScrollToItem effect)", () => {
    const v = createVirtualizer({ count: 100, estimateSize: 40 });
    // already visible → no movement
    expect(v.scrollOffsetFor(5, 400, 0)).toBe(0);
    // below the fold → align to end
    expect(v.scrollOffsetFor(20, 400, 0)).toBe(21 * 40 - 400);
    // above the fold → align to start
    expect(v.scrollOffsetFor(2, 400, 800)).toBe(80);
    expect(v.scrollOffsetFor(50, 400, 0, "center")).toBe(50 * 40 - (400 - 40) / 2);
  });

  it("stays O(log n): 500k items, build + 1k measures + 1k ranges under 250ms", () => {
    const start = performance.now();
    const v = createVirtualizer({
      count: 500_000,
      estimateSize: () => 30 + ((Math.random() * 20) | 0),
    });
    for (let i = 0; i < 1000; i++) v.measure((i * 499) % 500_000, 25 + (i % 50));
    let sink = 0;
    for (let i = 0; i < 1000; i++) {
      sink += v.range((i * 7919) % v.totalSize(), 900).items.length;
    }
    const elapsed = performance.now() - start;
    expect(sink).toBeGreaterThan(0);
    expect(v.indexAt(v.totalSize() + 5000)).toBe(499_999);
    expect(elapsed).toBeLessThan(250);
  });
});
