import type { Effect } from "./effect";
import type { Intent } from "./intent";

/**
 * Machines — pure transition functions.
 *
 * A machine is `(state, intent) → { state, effects }`. No classes, no
 * subscriptions, no time: those belong to the Store. Because transitions are
 * pure they can be unit-tested without React, DOM or browser, replayed, and
 * inspected.
 */

export interface Transition<S> {
  readonly state: S;
  readonly effects: readonly Effect[];
}

/** Handlers may return just the next state, or a state + effects pair. */
export type TransitionResult<S> = S | Transition<S>;

export type IntentHandler<S, TPayload = unknown> = (
  state: S,
  intent: Intent<TPayload>,
) => TransitionResult<S>;

export interface Machine<S> {
  readonly id: string;
  readonly initialState: S;
  reduce(state: S, intent: Intent): Transition<S>;
}

export const withEffects = <S>(state: S, ...effects: Effect[]): Transition<S> => ({
  state,
  effects,
});

export const toTransition = <S>(result: TransitionResult<S>): Transition<S> =>
  result !== null &&
  typeof result === "object" &&
  "state" in (result as object) &&
  "effects" in (result as object)
    ? (result as Transition<S>)
    : { state: result as S, effects: [] };

export interface MachineConfig<S> {
  id: string;
  initialState: S;
  /** Map of intent type → handler. Unknown intents are no-ops by design. */
  handlers: Record<string, IntentHandler<S, never>>;
}

export function createMachine<S>({ id, initialState, handlers }: MachineConfig<S>): Machine<S> {
  return {
    id,
    initialState,
    reduce(state, intent) {
      const handler = handlers[intent.type] as IntentHandler<S> | undefined;
      if (!handler) return { state, effects: [] };
      return toTransition(handler(state, intent));
    },
  };
}
