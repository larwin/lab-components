/**
 * Breadcrumbs collapse policy — pure list math, shared by any renderer.
 *
 * Past `maxVisible` segments the middle collapses into a "…" menu: the first
 * segment stays (the root anchors the user), the last `maxVisible - 2`
 * segments stay (the local context matters most), everything in between goes
 * to the overflow menu. Collapsing never hides a single segment — the menu
 * would take more room than the crumb itself.
 */

export interface CollapsedBreadcrumbs<T> {
  readonly head: readonly T[];
  /** Segments folded into the overflow menu (empty = no collapse). */
  readonly collapsed: readonly T[];
  readonly tail: readonly T[];
}

export function collapseBreadcrumbs<T>(
  items: readonly T[],
  maxVisible = 4,
): CollapsedBreadcrumbs<T> {
  const max = Math.max(3, maxVisible);
  // +1: an overflow menu hiding one segment saves nothing.
  if (items.length <= max + 1) return { head: items, collapsed: [], tail: [] };
  const tailCount = max - 2;
  return {
    head: items.slice(0, 1),
    collapsed: items.slice(1, items.length - tailCount),
    tail: items.slice(items.length - tailCount),
  };
}
