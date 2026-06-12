import { useCallback, useEffect, useRef } from "react";
import {
  cancelEffect,
  createLoaderMachine,
  fetchEffect,
  loadIntents,
  type LoaderConfig,
  type LoaderState,
} from "../core/data/loader";
import type { DataQuery, DataSource } from "../core/data/source";
import type { SortSpec } from "../core/data/query";
import { useMachine, useLiveRef } from "./useMachine";

/**
 * useDataSource — the adapter half of the loader machine.
 *
 * The machine decides *what* to fetch and how to reconcile responses; this
 * hook only executes: it interprets `data/fetch` by running the DataSource
 * with an AbortController and feeding the outcome back as resolve/reject
 * intents, and `data/cancel` by aborting. Swap the source, keep everything.
 */

export interface UseDataSourceResult<T> {
  state: LoaderState<T>;
  refresh(): void;
  loadMore(): void;
  cancel(): void;
  setSort(sort: readonly SortSpec[]): void;
  setFilter(filter: string): void;
  /** Number of requests aborted so far (observability for demos/devtools). */
  abortedCount: number;
}

export function useDataSource<T>(
  source: DataSource<T>,
  config: LoaderConfig = {},
): UseDataSourceResult<T> {
  const { state, dispatch, store } = useMachine(() => createLoaderMachine<T>(config));
  const live = useLiveRef({ source });
  const controllers = useRef(new Map<number, AbortController>());
  const aborted = useRef(0);

  useEffect(
    () =>
      store.onEffect((effect) => {
        if (fetchEffect.match(effect)) {
          const { seq, query } = effect.payload as { seq: number; query: DataQuery };
          const controller = new AbortController();
          controllers.current.set(seq, controller);
          live.current
            .source(query, controller.signal)
            .then((page) => dispatch(loadIntents.resolve({ seq, page })))
            .catch((error: unknown) => {
              if (controller.signal.aborted) return; // cancellation is not an error
              dispatch(
                loadIntents.reject({
                  seq,
                  error: error instanceof Error ? error.message : String(error),
                }),
              );
            })
            .finally(() => controllers.current.delete(seq));
        } else if (cancelEffect.match(effect)) {
          const { seq } = effect.payload as { seq: number };
          const controller = controllers.current.get(seq);
          if (controller) {
            aborted.current += 1;
            controller.abort();
            controllers.current.delete(seq);
          }
        }
      }),
    [store, dispatch, live],
  );

  // Abort everything on unmount.
  useEffect(
    () => () => {
      for (const controller of controllers.current.values()) controller.abort();
      controllers.current.clear();
    },
    [],
  );

  return {
    state,
    refresh: useCallback(() => dispatch(loadIntents.refresh(undefined)), [dispatch]),
    loadMore: useCallback(() => dispatch(loadIntents.loadMore(undefined)), [dispatch]),
    cancel: useCallback(() => dispatch(loadIntents.cancel(undefined)), [dispatch]),
    setSort: useCallback(
      (sort: readonly SortSpec[]) => dispatch(loadIntents.setSort({ sort })),
      [dispatch],
    ),
    setFilter: useCallback(
      (filter: string) => dispatch(loadIntents.setFilter({ filter })),
      [dispatch],
    ),
    abortedCount: aborted.current,
  };
}
