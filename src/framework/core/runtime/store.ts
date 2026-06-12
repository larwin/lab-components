import type { Effect } from "./effect";
import type { Intent } from "./intent";
import type { Machine } from "./machine";

/**
 * Store — the only stateful object in the core.
 *
 * Owns the current state of one machine, dispatches intents through the pure
 * reducer, notifies subscribers, hands effects to interpreters, and records a
 * transition journal for devtools / time-travel. Still framework-free: the
 * React adapter is just `useSyncExternalStore` over this.
 */

export interface TransitionRecord<S = unknown> {
  readonly seq: number;
  readonly storeId: string;
  readonly intent: Intent;
  readonly prevState: S;
  readonly nextState: S;
  readonly effects: readonly Effect[];
  readonly at: number;
}

export type EffectHandler<S> = (effect: Effect, context: { state: S; intent: Intent }) => void;

export interface Store<S> {
  readonly id: string;
  getState(): S;
  /** Dispatch an intent; returns the effects produced (also sent to handlers). */
  dispatch(intent: Intent): readonly Effect[];
  subscribe(listener: () => void): () => void;
  onEffect(handler: EffectHandler<S>): () => void;
  /** Ring-buffered transition history (devtools). */
  getJournal(): readonly TransitionRecord<S>[];
  /** Time-travel: jump to an arbitrary state without producing effects. */
  replaceState(state: S): void;
}

export interface StoreOptions {
  /** Journal capacity; 0 disables journaling. */
  journalSize?: number;
  /** Clock, injectable for deterministic tests. */
  now?: () => number;
}

/* Global inspector bus — every store broadcasts transitions here so the
 * Engine Inspector playground can observe the whole app, Redux-DevTools style. */
type InspectorListener = (record: TransitionRecord) => void;
const inspectorListeners = new Set<InspectorListener>();

export function inspect(listener: InspectorListener): () => void {
  inspectorListeners.add(listener);
  return () => inspectorListeners.delete(listener);
}

let storeSeq = 0;
let transitionSeq = 0;

export function createStore<S>(machine: Machine<S>, options: StoreOptions = {}): Store<S> {
  const journalSize = options.journalSize ?? 200;
  const now = options.now ?? (() => Date.now());

  let state = machine.initialState;
  const id = `${machine.id}#${++storeSeq}`;
  const listeners = new Set<() => void>();
  const effectHandlers = new Set<EffectHandler<S>>();
  const journal: TransitionRecord<S>[] = [];

  const record = (entry: TransitionRecord<S>) => {
    if (journalSize > 0) {
      journal.push(entry);
      if (journal.length > journalSize) journal.shift();
    }
    for (const l of inspectorListeners) l(entry as TransitionRecord);
  };

  return {
    id,
    getState: () => state,

    dispatch(intent) {
      const prev = state;
      const { state: next, effects } = machine.reduce(prev, intent);
      const changed = next !== prev;
      state = next;
      record({
        seq: ++transitionSeq,
        storeId: id,
        intent,
        prevState: prev,
        nextState: next,
        effects,
        at: now(),
      });
      if (changed) for (const l of listeners) l();
      for (const effect of effects) {
        for (const h of effectHandlers) h(effect, { state: next, intent });
      }
      return effects;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    onEffect(handler) {
      effectHandlers.add(handler);
      return () => effectHandlers.delete(handler);
    },

    getJournal: () => journal,

    replaceState(next) {
      if (next === state) return;
      state = next;
      for (const l of listeners) l();
    },
  };
}
