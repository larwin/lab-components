import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { AnyBehavior, ComposedMachine, ComposedState } from "../core/behaviors/behavior";
import type { Intent } from "../core/runtime/intent";
import type { Machine } from "../core/runtime/machine";
import { createStore, type Store } from "../core/runtime/store";

/**
 * React adapter — machines. The store is the source of truth; React renders it
 * through useSyncExternalStore. The factory runs once: config callbacks should
 * read live props through `useLiveRef` so machines never need rebuilding.
 */

export interface MachineHandle<S> {
  state: S;
  dispatch(intent: Intent): void;
  store: Store<S>;
}

export function useMachine<S>(factory: () => Machine<S>): MachineHandle<S> {
  const [store] = useState(() => createStore(factory()));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const dispatch = useCallback((intent: Intent) => void store.dispatch(intent), [store]);
  return { state, dispatch, store };
}

export interface ComposedHandle<Bs extends readonly AnyBehavior[]> extends MachineHandle<
  ComposedState<Bs>
> {
  composed: ComposedMachine<Bs>;
}

export function useComposedMachine<Bs extends readonly AnyBehavior[]>(
  factory: () => ComposedMachine<Bs>,
): ComposedHandle<Bs> {
  const [composed] = useState(factory);
  const handle = useMachine(() => composed.machine);
  return { ...handle, composed };
}

/** A ref that always holds the latest value — for machine config getters. */
export function useLiveRef<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
