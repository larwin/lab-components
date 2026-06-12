/**
 * Overflow partition — pure width math for "… menu" toolbars.
 *
 * Given measured widths (injected — the core never measures anything) and a
 * per-item priority, decide which items stay visible and which collapse into
 * an overflow menu. The trigger button's width is reserved as soon as at
 * least one item overflows, so the row never jitters between states.
 *
 * Policy:
 *  - if everything fits, nothing overflows and no trigger is shown;
 *  - otherwise items leave the row lowest priority first (ties: rightmost
 *    first — the end of a toolbar holds the least essential actions);
 *  - both lists preserve the original document order;
 *  - separators never enter the menu: a separator left dangling (row edge,
 *    doubled, or right before the trigger) is simply dropped from the row.
 */

export interface OverflowItem {
  readonly key: string;
  /** Measured outer width, px. */
  readonly width: number;
  /** Higher priority stays visible longer. Default 0. */
  readonly priority?: number;
  /** Separators are layout-only: they collapse, they never enter the menu. */
  readonly kind?: "item" | "separator";
}

export interface OverflowInput {
  readonly items: readonly OverflowItem[];
  /** Inner width available for the whole row, px. */
  readonly availableWidth: number;
  /** Measured width of the "…" trigger, px (reserved only when overflowing). */
  readonly triggerWidth: number;
  /** Gap between adjacent row children, px. Default 0. */
  readonly gap?: number;
}

export interface OverflowPartition {
  /** Keys still rendered in the row, document order (separators included). */
  readonly visibleKeys: readonly string[];
  /** Item keys folded into the overflow menu, document order (no separators). */
  readonly overflowKeys: readonly string[];
  /** True when the "…" trigger must be rendered (and was budgeted for). */
  readonly hasOverflow: boolean;
}

const rowWidth = (widths: readonly number[], gap: number): number =>
  widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);

/** Drop separators that ended up dangling: leading, doubled, or trailing. */
const pruneSeparators = (visible: readonly OverflowItem[]): readonly OverflowItem[] => {
  const result: OverflowItem[] = [];
  for (const item of visible) {
    if (
      item.kind === "separator" &&
      (result.length === 0 || result[result.length - 1].kind === "separator")
    ) {
      continue;
    }
    result.push(item);
  }
  while (result.length > 0 && result[result.length - 1].kind === "separator") result.pop();
  return result;
};

export function partitionOverflow(input: OverflowInput): OverflowPartition {
  const { items, availableWidth, triggerWidth } = input;
  const gap = input.gap ?? 0;

  if (
    rowWidth(
      items.map((i) => i.width),
      gap,
    ) <= availableWidth
  ) {
    return { visibleKeys: items.map((i) => i.key), overflowKeys: [], hasOverflow: false };
  }

  // Something overflows: the trigger is now part of the row.
  // Eviction order: lowest priority first; ties evict from the right.
  const evictionOrder = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind !== "separator")
    .sort((a, b) => (a.item.priority ?? 0) - (b.item.priority ?? 0) || b.index - a.index);

  const overflowed = new Set<string>();
  const visibleRow = (): readonly OverflowItem[] =>
    pruneSeparators(items.filter((i) => !overflowed.has(i.key)));
  const fits = (): boolean =>
    rowWidth([...visibleRow().map((i) => i.width), triggerWidth], gap) <= availableWidth;

  for (const { item } of evictionOrder) {
    if (fits()) break;
    overflowed.add(item.key);
  }

  return {
    visibleKeys: visibleRow().map((i) => i.key),
    overflowKeys: items
      .filter((i) => overflowed.has(i.key) && i.kind !== "separator")
      .map((i) => i.key),
    hasOverflow: true,
  };
}
