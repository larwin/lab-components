// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createStore } from "../runtime/store";
import { emitEvent } from "../runtime/effect";
import {
  createPaginationMachine,
  pageCountOf,
  paginationIntents,
  paginationRange,
  type PaginationState,
} from "./pagination";

const makePagination = (total: number, config: { page?: number; pageSize?: number } = {}) => {
  let liveTotal = total;
  const store = createStore(
    createPaginationMachine({
      getTotal: () => liveTotal,
      defaultPage: config.page,
      defaultPageSize: config.pageSize ?? 10,
    }),
  );
  const state = () => store.getState() as PaginationState;
  return { store, state, setTotal: (t: number) => (liveTotal = t) };
};

describe("Pagination machine", () => {
  it("navigates with clamping at both edges", () => {
    const { store, state } = makePagination(95); // 10 pages
    store.dispatch(paginationIntents.next(undefined, "pointer"));
    expect(state().page).toBe(2);
    store.dispatch(paginationIntents.last(undefined, "pointer"));
    expect(state().page).toBe(10);
    expect(store.dispatch(paginationIntents.next(undefined, "pointer"))).toHaveLength(0);
    store.dispatch(paginationIntents.first(undefined, "pointer"));
    expect(state().page).toBe(1);
    expect(store.dispatch(paginationIntents.previous(undefined, "pointer"))).toHaveLength(0);
  });

  it("goTo clamps out-of-range targets against the live total", () => {
    const { store, state, setTotal } = makePagination(95);
    store.dispatch(paginationIntents.goTo({ page: 42 }, "pointer"));
    expect(state().page).toBe(10);
    // The data shrank: the next navigation re-clamps.
    setTotal(31);
    store.dispatch(paginationIntents.goTo({ page: 10 }, "program"));
    expect(state().page).toBe(4);
  });

  it("emits pageChange only on real change", () => {
    const { store } = makePagination(95);
    const effects = store.dispatch(paginationIntents.goTo({ page: 3 }, "pointer"));
    const event = effects.find((e) => emitEvent.match(e) && e.payload.name === "pageChange");
    expect(event).toBeDefined();
    expect(store.dispatch(paginationIntents.goTo({ page: 3 }, "pointer"))).toHaveLength(0);
  });

  it("setPageSize keeps the first visible item on screen", () => {
    const { store, state } = makePagination(200, { page: 5, pageSize: 10 }); // items 41-50
    store.dispatch(paginationIntents.setPageSize({ pageSize: 25 }, "pointer"));
    // Item 41 lives on page 2 of 25.
    expect(state()).toEqual({ page: 2, pageSize: 25 });
  });

  it("pageCountOf never returns less than one page", () => {
    expect(pageCountOf(0, 10)).toBe(1);
    expect(pageCountOf(11, 10)).toBe(2);
  });
});

describe("paginationRange — the ellipsis window", () => {
  it("shows every page when they all fit", () => {
    expect(paginationRange(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the far side only, near an edge", () => {
    expect(paginationRange(2, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis", 20]);
    expect(paginationRange(19, 20)).toEqual([1, "ellipsis", 16, 17, 18, 19, 20]);
  });

  it("collapses both sides in the middle", () => {
    expect(paginationRange(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
  });

  it("an ellipsis never hides a single page", () => {
    // Page 4 of 10: hiding only page 2 would be silly — 2 stays visible.
    expect(paginationRange(4, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
  });

  it("honours wider sibling/boundary windows", () => {
    expect(paginationRange(10, 30, 2, 2)).toEqual([
      1,
      2,
      "ellipsis",
      8,
      9,
      10,
      11,
      12,
      "ellipsis",
      29,
      30,
    ]);
  });
});
