import type { Intent } from "../runtime/intent";
import { toTransition, type Machine, type TransitionResult } from "../runtime/machine";
import type { Effect } from "../runtime/effect";
import type { KeyStroke } from "../interaction/keys";

/**
 * Behaviors — the unit of composition in Forge.
 *
 * A component is not a monolith: it is a *composition of behaviors*
 * (Focusable + Pressable = Button; Selectable + Expandable + Navigable = Tree).
 *
 * Each behavior contributes four orthogonal fragments:
 *  - a state slice (namespaced under the behavior's name)
 *  - intent handlers (pure reducers over its slice)
 *  - a declarative keymap (key combo → intent, no event handling here)
 *  - ARIA attributes derived from state
 *
 * `composeMachine` merges any set of behaviors into a single pure Machine.
 * Several behaviors may handle the same intent (e.g. `nav/move` moves focus in
 * Navigable *and* extends the selection in Selectable when follow-focus is on);
 * handlers run as a pipeline in composition order.
 */

export type AriaValue = string | number | boolean | undefined;
export interface AriaProps {
  role?: string;
  tabIndex?: number;
  [key: `aria-${string}`]: AriaValue;
  [key: `data-${string}`]: AriaValue;
}

export interface KeyBinding {
  /** Combo syntax: "ArrowDown", "Mod+A", "Shift+Home", "Ctrl+Alt+K". */
  keys: string;
  /** Build the intent to dispatch for this stroke; return null to fall through. */
  intent: (stroke: KeyStroke) => Intent | null;
  /** Defaults to true. */
  preventDefault?: boolean;
}

export interface BehaviorContext<TConfig> {
  readonly config: TConfig;
  /** Read a sibling behavior's slice (already updated by earlier handlers in this dispatch). */
  read<T>(behaviorName: string): T | undefined;
  /** Read a sibling slice as it was *before* this dispatch started. */
  readInitial<T>(behaviorName: string): T | undefined;
}

export type SliceHandler<Slice, TConfig> = (
  slice: Slice,
  intent: Intent<never>,
  ctx: BehaviorContext<TConfig>,
) => TransitionResult<Slice>;

export interface Behavior<Name extends string = string, Slice = unknown, TConfig = object> {
  readonly name: Name;
  initial(config: TConfig): Slice;
  readonly handlers: Record<string, SliceHandler<Slice, TConfig>>;
  keymap?(slice: Slice, ctx: BehaviorContext<TConfig>): KeyBinding[];
  aria?(slice: Slice, ctx: BehaviorContext<TConfig>): AriaProps;
}

export function defineBehavior<Name extends string, Slice, TConfig = object>(
  behavior: Behavior<Name, Slice, TConfig>,
): Behavior<Name, Slice, TConfig> {
  return behavior;
}

/* ---------------------------- composition ---------------------------- */

// `any` is required for assignability of concrete behaviors under
// strictFunctionTypes (slices appear in contravariant handler positions).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBehavior = Behavior<string, any, any>;

type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (
  i: infer I,
) => void
  ? I
  : never;

/* eslint-disable @typescript-eslint/no-explicit-any */
type SliceOf<B> = B extends Behavior<string, infer S, any> ? S : never;
type NameOf<B> = B extends Behavior<infer N, any, any> ? N : never;
type ConfigOf<B> = B extends Behavior<string, any, infer C> ? C : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

export type ComposedState<Bs extends readonly AnyBehavior[]> = UnionToIntersection<
  { [K in keyof Bs]: Record<NameOf<Bs[K]>, SliceOf<Bs[K]>> }[number]
> &
  Record<string, unknown>;

export type ComposedConfig<Bs extends readonly AnyBehavior[]> = UnionToIntersection<
  { [K in keyof Bs]: ConfigOf<Bs[K]> }[number]
>;

export interface ComposedMachine<Bs extends readonly AnyBehavior[]> {
  machine: Machine<ComposedState<Bs>>;
  /** All key bindings active for the current state, in composition order. */
  keymap(state: ComposedState<Bs>): KeyBinding[];
  /** Merged ARIA attributes for the current state (later behaviors win). */
  aria(state: ComposedState<Bs>): AriaProps;
}

export function composeMachine<const Bs extends readonly AnyBehavior[]>(
  id: string,
  behaviors: Bs,
  config: ComposedConfig<Bs>,
): ComposedMachine<Bs> {
  type S = ComposedState<Bs>;

  const ctxFor = (
    state: Record<string, unknown>,
    initial: Record<string, unknown> = state,
  ): BehaviorContext<never> => ({
    config: config as never,
    read: <T>(name: string) => state[name] as T | undefined,
    readInitial: <T>(name: string) => initial[name] as T | undefined,
  });

  const initialState = Object.fromEntries(
    behaviors.map((b) => [b.name, b.initial(config as never)]),
  ) as S;

  const machine: Machine<S> = {
    id,
    initialState,
    reduce(state, intent) {
      let next: Record<string, unknown> = state;
      const effects: Effect[] = [];
      for (const behavior of behaviors) {
        const handler = behavior.handlers[intent.type];
        if (!handler) continue;
        const slice = next[behavior.name];
        const result = toTransition(handler(slice, intent as Intent<never>, ctxFor(next, state)));
        effects.push(...result.effects);
        if (result.state !== slice) {
          if (next === state) next = { ...state };
          next[behavior.name] = result.state;
        }
      }
      return { state: next as S, effects };
    },
  };

  return {
    machine,
    keymap(state) {
      const bindings: KeyBinding[] = [];
      for (const b of behaviors) {
        if (!b.keymap) continue;
        bindings.push(...b.keymap(state[b.name as keyof S] as never, ctxFor(state)));
      }
      return bindings;
    },
    aria(state) {
      let merged: AriaProps = {};
      for (const b of behaviors) {
        if (!b.aria) continue;
        merged = { ...merged, ...b.aria(state[b.name as keyof S] as never, ctxFor(state)) };
      }
      return merged;
    },
  };
}
