/**
 * Virtualizer — pure windowing math, designed for hundreds of thousands of
 * items with *dynamic* sizes.
 *
 * Sizes live in a Fenwick (binary indexed) tree, so measuring an item after
 * render is O(log n) and computing any offset / locating the item at a scroll
 * position is O(log n) — no O(n) prefix-sum rebuilds while scrolling, which is
 * what makes 500k dynamic-height rows tractable. No DOM here: adapters feed
 * scroll offsets in and apply the computed window out. Horizontal, vertical
 * and 2D virtualization are the same object pointed at different axes.
 */

class FenwickTree {
  private readonly tree: Float64Array;
  constructor(
    private readonly n: number,
    initialSizes?: Float64Array,
  ) {
    this.tree = new Float64Array(n + 1);
    if (initialSizes) {
      // Linear-time construction (vs n·log n for repeated add()).
      for (let i = 1; i <= n; i++) {
        this.tree[i] += initialSizes[i - 1];
        const parent = i + (i & -i);
        if (parent <= n) this.tree[parent] += this.tree[i];
      }
    }
  }
  /** Add `delta` at index i (0-based). O(log n). */
  add(i: number, delta: number): void {
    for (let x = i + 1; x <= this.n; x += x & -x) this.tree[x] += delta;
  }
  /** Sum of [0, i) — offset of item i. O(log n). */
  prefix(i: number): number {
    let sum = 0;
    for (let x = i; x > 0; x -= x & -x) sum += this.tree[x];
    return sum;
  }
  /** Largest index whose prefix sum is <= target. O(log n). */
  lowerBound(target: number): number {
    let index = 0;
    let remaining = target;
    let mask = 1 << (31 - Math.clz32(this.n || 1));
    while (mask > 0) {
      const next = index + mask;
      if (next <= this.n && this.tree[next] <= remaining) {
        remaining -= this.tree[next];
        index = next;
      }
      mask >>= 1;
    }
    return index; // 0-based index of the item containing `target`
  }
}

export interface VirtualItem {
  readonly index: number;
  readonly start: number;
  readonly size: number;
}

export interface VirtualRange {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly items: readonly VirtualItem[];
  readonly totalSize: number;
}

export interface VirtualizerOptions {
  count: number;
  /** Estimated size for unmeasured items (px, or any consistent unit). */
  estimateSize: number | ((index: number) => number);
  overscan?: number;
}

export interface Virtualizer {
  readonly count: number;
  /** Record the real size of an item after measurement. O(log n). */
  measure(index: number, size: number): boolean;
  sizeOf(index: number): number;
  offsetOf(index: number): number;
  totalSize(): number;
  indexAt(offset: number): number;
  /** The window of items to render for a viewport. */
  range(scrollOffset: number, viewportSize: number): VirtualRange;
  /** Offset to scroll so that `index` is visible (for ScrollToItem effects). */
  scrollOffsetFor(
    index: number,
    viewportSize: number,
    currentOffset: number,
    align?: "auto" | "start" | "center" | "end",
  ): number;
}

export function createVirtualizer({
  count,
  estimateSize,
  overscan = 4,
}: VirtualizerOptions): Virtualizer {
  const estimate = typeof estimateSize === "function" ? estimateSize : () => estimateSize;
  const sizes = new Float64Array(count);
  for (let i = 0; i < count; i++) sizes[i] = estimate(i);
  const tree = new FenwickTree(count, sizes);

  const clampIndex = (i: number) => Math.max(0, Math.min(count - 1, i));

  const self: Virtualizer = {
    count,

    measure(index, size) {
      if (index < 0 || index >= count) return false;
      const delta = size - sizes[index];
      if (Math.abs(delta) < 0.5) return false;
      sizes[index] = size;
      tree.add(index, delta);
      return true;
    },

    sizeOf: (index) => sizes[index] ?? 0,
    offsetOf: (index) => tree.prefix(clampIndex(index)),
    totalSize: () => (count === 0 ? 0 : tree.prefix(count)),
    indexAt: (offset) => clampIndex(tree.lowerBound(Math.max(0, offset))),

    range(scrollOffset, viewportSize) {
      if (count === 0) {
        return { startIndex: 0, endIndex: -1, items: [], totalSize: 0 };
      }
      const first = self.indexAt(scrollOffset);
      const last = self.indexAt(scrollOffset + Math.max(0, viewportSize - 1));
      const startIndex = Math.max(0, first - overscan);
      const endIndex = Math.min(count - 1, last + overscan);
      const items: VirtualItem[] = [];
      let start = tree.prefix(startIndex);
      for (let index = startIndex; index <= endIndex; index++) {
        const size = sizes[index];
        items.push({ index, start, size });
        start += size;
      }
      return { startIndex, endIndex, items, totalSize: self.totalSize() };
    },

    scrollOffsetFor(index, viewportSize, currentOffset, align = "auto") {
      const i = clampIndex(index);
      const start = tree.prefix(i);
      const size = sizes[i];
      const end = start + size;
      switch (align) {
        case "start":
          return start;
        case "end":
          return end - viewportSize;
        case "center":
          return start - (viewportSize - size) / 2;
        default: {
          if (start < currentOffset) return start;
          if (end > currentOffset + viewportSize) return end - viewportSize;
          return currentOffset;
        }
      }
    },
  };
  return self;
}
