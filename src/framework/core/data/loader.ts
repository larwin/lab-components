import { defineEffect, type Effect } from "../runtime/effect";
import { defineIntent } from "../runtime/intent";
import { createMachine, withEffects, type Machine } from "../runtime/machine";
import type { SortSpec } from "./query";
import type { DataPage, DataQuery } from "./source";

/**
 * Loader machine — async data as pure state.
 *
 * The hard parts of remote data are not the fetch; they are the *races*:
 * a slow page-2 response landing after the user re-sorted, a refresh racing
 * a load-more, cancellation on rapid filter typing. This machine makes all of
 * it deterministic and unit-testable:
 *
 *  - every request gets a monotonic `seq`; the reducer emits a `data/fetch`
 *    effect and the adapter runs the DataSource with an AbortSignal
 *  - responses come back as resolve/reject *intents* carrying their seq;
 *    stale sequences are ignored by the reducer — races are impossible by
 *    construction, not by adapter discipline
 *  - starting a new request emits `data/cancel` for the previous in-flight
 *    seq, which the adapter maps to AbortController.abort()
 *
 * Pagination is cursor-based and append-only (infinite scroll); `refresh`
 * resets the window. Query changes (sort/filter) reset and refetch.
 */

export interface LoaderQueryState {
  readonly sort: readonly SortSpec[];
  readonly filter: string;
}

export interface LoaderState<T> {
  readonly status: "idle" | "loading" | "loadingMore" | "ready" | "error";
  readonly items: readonly T[];
  readonly query: LoaderQueryState;
  readonly cursor: string | null;
  readonly hasMore: boolean;
  readonly total: number | null;
  readonly error: string | null;
  /** Sequence of the request currently in flight (null when settled). */
  readonly inflightSeq: number | null;
  readonly lastSeq: number;
}

export const loadIntents = {
  refresh: defineIntent<void>("load/refresh"),
  loadMore: defineIntent<void>("load/more"),
  resolve: defineIntent<{ seq: number; page: DataPage<unknown> }>("load/resolve"),
  reject: defineIntent<{ seq: number; error: string }>("load/reject"),
  cancel: defineIntent<void>("load/cancel"),
  setSort: defineIntent<{ sort: readonly SortSpec[] }>("load/set-sort"),
  setFilter: defineIntent<{ filter: string }>("load/set-filter"),
};

/** Executed by the adapter: run the DataSource for this seq/query. */
export const fetchEffect = defineEffect<{ seq: number; query: DataQuery }>("data/fetch");
/** Executed by the adapter: abort the in-flight request with this seq. */
export const cancelEffect = defineEffect<{ seq: number }>("data/cancel");

export interface LoaderConfig {
  pageSize?: number;
  initialSort?: readonly SortSpec[];
}

export function createLoaderMachine<T>(config: LoaderConfig = {}): Machine<LoaderState<T>> {
  const pageSize = config.pageSize ?? 100;

  const initialState: LoaderState<T> = {
    status: "idle",
    items: [],
    query: { sort: config.initialSort ?? [], filter: "" },
    cursor: null,
    hasMore: true,
    total: null,
    error: null,
    inflightSeq: null,
    lastSeq: 0,
  };

  const startRequest = (state: LoaderState<T>, mode: "reset" | "append") => {
    const seq = state.lastSeq + 1;
    const cursor = mode === "reset" ? null : state.cursor;
    const next: LoaderState<T> = {
      ...state,
      status: mode === "reset" ? "loading" : "loadingMore",
      items: mode === "reset" ? [] : state.items,
      cursor,
      hasMore: mode === "reset" ? true : state.hasMore,
      error: null,
      inflightSeq: seq,
      lastSeq: seq,
    };
    const effects: Effect[] = [
      fetchEffect({
        seq,
        query: { sort: next.query.sort, filter: next.query.filter, cursor, limit: pageSize },
      }),
    ];
    if (state.inflightSeq !== null) {
      effects.unshift(cancelEffect({ seq: state.inflightSeq }));
    }
    return withEffects(next, ...effects);
  };

  return createMachine<LoaderState<T>>({
    id: "loader",
    initialState,
    handlers: {
      [loadIntents.refresh.type]: (state) => startRequest(state, "reset"),

      [loadIntents.loadMore.type]: (state) => {
        // Ignore while a request is in flight or when everything is loaded.
        if (state.inflightSeq !== null || !state.hasMore || state.status === "idle") return state;
        return startRequest(state, "append");
      },

      [loadIntents.resolve.type]: (state, intent) => {
        const { seq, page } = intent.payload as { seq: number; page: DataPage<T> };
        if (seq !== state.inflightSeq) return state; // stale response — ignored
        return {
          ...state,
          status: "ready",
          items: [...state.items, ...page.items],
          cursor: page.nextCursor,
          hasMore: page.nextCursor !== null,
          total: page.total ?? state.total,
          inflightSeq: null,
        };
      },

      [loadIntents.reject.type]: (state, intent) => {
        const { seq, error } = intent.payload as { seq: number; error: string };
        if (seq !== state.inflightSeq) return state; // stale failure — ignored
        return { ...state, status: "error", error, inflightSeq: null };
      },

      [loadIntents.cancel.type]: (state) => {
        if (state.inflightSeq === null) return state;
        return withEffects(
          {
            ...state,
            status: state.items.length > 0 ? "ready" : "idle",
            inflightSeq: null,
          },
          cancelEffect({ seq: state.inflightSeq }),
        );
      },

      [loadIntents.setSort.type]: (state, intent) => {
        const { sort } = intent.payload as { sort: readonly SortSpec[] };
        return startRequest({ ...state, query: { ...state.query, sort } }, "reset");
      },

      [loadIntents.setFilter.type]: (state, intent) => {
        const { filter } = intent.payload as { filter: string };
        if (filter === state.query.filter) return state;
        return startRequest({ ...state, query: { ...state.query, filter } }, "reset");
      },
    },
  });
}
