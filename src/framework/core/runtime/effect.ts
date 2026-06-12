/**
 * Effects — declarative side-effect descriptions.
 *
 * A reducer never executes anything: it returns the next state plus a list of
 * effects describing what *should* happen (focus an element, scroll, announce
 * to screen readers, emit an output event…). Adapters (React/DOM today, others
 * tomorrow) interpret them. This keeps the core pure, deterministic and
 * replayable, and makes side-effects assertable in unit tests.
 */

export interface Effect<TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
}

export interface EffectFactory<TPayload = void> {
  (payload: TPayload): Effect<TPayload>;
  readonly type: string;
  match(effect: Effect): effect is Effect<TPayload>;
}

export function defineEffect<TPayload = void>(type: string): EffectFactory<TPayload> {
  const factory = ((payload: TPayload) => ({ type, payload })) as EffectFactory<TPayload>;
  Object.defineProperty(factory, "type", { value: type, enumerable: true });
  factory.match = (effect: Effect): effect is Effect<TPayload> => effect.type === type;
  return factory;
}

/* ------------------------------------------------------------------ */
/* Standard effect catalogue                                           */
/* Adapters provide interpreters for these. Components may define more. */
/* ------------------------------------------------------------------ */

/** Move DOM focus to the element registered under `target` ("self" = host). */
export const focusElement = defineEffect<{ target: string }>("dom/focus-element");

/** Ensure the item registered under `key` is scrolled into view. */
export const scrollToItem = defineEffect<{
  key: string;
  align?: "auto" | "start" | "center" | "end";
}>("dom/scroll-to-item");

/** Polite/assertive screen-reader announcement via a live region. */
export const announce = defineEffect<{
  message: string;
  politeness?: "polite" | "assertive";
}>("a11y/announce");

/** Return focus to the element focused before an overlay opened. */
export const restoreFocus = defineEffect<void>("dom/restore-focus");

/**
 * Emit a component output event. This is how pure machines talk to userland
 * callbacks: the adapter maps `event/emit { name: "press" }` to `onPress()`.
 */
export const emitEvent = defineEffect<{ name: string; detail?: unknown }>("event/emit");

/** Ask the data layer to load something (page, children of a node…). */
export const loadData = defineEffect<{ request: string; params?: unknown }>("data/load");
