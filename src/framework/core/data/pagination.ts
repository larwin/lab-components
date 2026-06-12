import { createMachine, withEffects, type Machine } from "../runtime/machine";
import { defineIntent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";

/**
 * Pagination — a pure machine over (page, pageSize) with the total injected
 * through a config getter (it changes with the data, never lives in the
 * machine). The ellipsis window is core math too: `paginationRange` returns
 * the exact button sequence (numbers + "ellipsis" markers) so every renderer
 * agrees on the layout.
 */

export interface PaginationState {
  /** Current page, 1-based. */
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginationConfig {
  /** Total number of items (live getter — data may stream in). */
  getTotal(): number;
  defaultPage?: number;
  defaultPageSize?: number;
}

export const paginationIntents = {
  goTo: defineIntent<{ page: number }>("page/go-to"),
  next: defineIntent<void>("page/next"),
  previous: defineIntent<void>("page/previous"),
  first: defineIntent<void>("page/first"),
  last: defineIntent<void>("page/last"),
  /** Changes the size while keeping the first visible item on screen. */
  setPageSize: defineIntent<{ pageSize: number }>("page/set-size"),
};

export const pageCountOf = (total: number, pageSize: number): number =>
  Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

export function createPaginationMachine(config: PaginationConfig): Machine<PaginationState> {
  const initial: PaginationState = {
    page: Math.max(1, config.defaultPage ?? 1),
    pageSize: Math.max(1, config.defaultPageSize ?? 20),
  };

  const commit = (state: PaginationState, page: number, pageSize = state.pageSize) => {
    const clamped = Math.min(pageCountOf(config.getTotal(), pageSize), Math.max(1, page));
    if (clamped === state.page && pageSize === state.pageSize) return state;
    return withEffects(
      { page: clamped, pageSize },
      emitEvent({ name: "pageChange", detail: { page: clamped, pageSize } }),
    );
  };

  return createMachine<PaginationState>({
    id: "pagination",
    initialState: initial,
    handlers: {
      [paginationIntents.goTo.type]: (state, intent) =>
        commit(state, (intent.payload as { page: number }).page),
      [paginationIntents.next.type]: (state) => commit(state, state.page + 1),
      [paginationIntents.previous.type]: (state) => commit(state, state.page - 1),
      [paginationIntents.first.type]: (state) => commit(state, 1),
      [paginationIntents.last.type]: (state) =>
        commit(state, pageCountOf(config.getTotal(), state.pageSize)),
      [paginationIntents.setPageSize.type]: (state, intent) => {
        const pageSize = Math.max(1, (intent.payload as { pageSize: number }).pageSize);
        if (pageSize === state.pageSize) return state;
        // Keep the first item of the current page visible under the new size.
        const firstIndex = (state.page - 1) * state.pageSize;
        return commit(state, Math.floor(firstIndex / pageSize) + 1, pageSize);
      },
    },
  });
}

export type PaginationRangeItem = number | "ellipsis";

const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

/**
 * The visible button sequence: `boundaries` pages at each edge, `siblings`
 * pages around the current one, ellipses where pages are hidden. An ellipsis
 * never hides a single page (it would be longer than the page number itself).
 */
export function paginationRange(
  page: number,
  pageCount: number,
  siblings = 1,
  boundaries = 1,
): PaginationRangeItem[] {
  const totalShown = boundaries * 2 + siblings * 2 + 3;
  if (pageCount <= totalShown) return range(1, pageCount);

  const leftSibling = Math.max(page - siblings, boundaries + 2);
  const rightSibling = Math.min(page + siblings, pageCount - boundaries - 1);
  const showLeftEllipsis = leftSibling > boundaries + 2;
  const showRightEllipsis = rightSibling < pageCount - boundaries - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [
      ...range(1, boundaries + siblings * 2 + 2),
      "ellipsis",
      ...range(pageCount - boundaries + 1, pageCount),
    ];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    return [
      ...range(1, boundaries),
      "ellipsis",
      ...range(pageCount - boundaries - siblings * 2 - 1, pageCount),
    ];
  }
  return [
    ...range(1, boundaries),
    "ellipsis",
    ...range(leftSibling, rightSibling),
    "ellipsis",
    ...range(pageCount - boundaries + 1, pageCount),
  ];
}
