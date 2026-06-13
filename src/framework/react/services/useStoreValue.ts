import { useSyncExternalStore } from "react";

import type { StoreToken } from "@/framework/services";

import { useContainer } from "./ServicesProvider";

/**
 * Subscribe a component to a live store and select a slice of its snapshot.
 *
 * This is the same bridge `useMachine` uses: `useSyncExternalStore` over the
 * store's `subscribe`/`getState`. The store is resolved from the container, so
 * the component never sees the container or the store wiring.
 *
 * IMPORTANT: `selector` must return a referentially STABLE value when nothing
 * changed (a primitive, or a slice that keeps its identity across no-op
 * dispatches — the core only notifies when `next !== prev`). Returning a fresh
 * object/array literal every call (`s => ({ ...s })`) causes an infinite render
 * loop. Select stable slices (`s => s.items`) or precompute the projection
 * inside the store's snapshot (e.g. an index `Map` built in the reducer).
 */
export function useStoreValue<S, U>(token: StoreToken<S>, selector: (state: S) => U): U {
  const store = useContainer().get(token);
  const snapshot = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}
