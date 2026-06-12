/**
 * Intents — the only way state changes in Forge.
 *
 * An intent is a serializable description of *what the user (or program) wants*,
 * decoupled from how it was produced (keyboard, pointer, shortcut, test, replay).
 * Reducers consume intents; nothing else mutates state.
 */

export type InteractionSource =
  | "keyboard"
  | "pointer"
  | "touch"
  | "pen"
  | "shortcut"
  | "program"
  | "replay";

export interface Intent<TPayload = unknown> {
  readonly type: string;
  readonly payload: TPayload;
  /** How the intent was produced. Purely informational (devtools, policies). */
  readonly source: InteractionSource;
}

export interface IntentFactory<TPayload = void> {
  (payload: TPayload, source?: InteractionSource): Intent<TPayload>;
  readonly type: string;
  /** Type guard usable in reducers and tests. */
  match(intent: Intent): intent is Intent<TPayload>;
}

/**
 * Defines a typed intent factory.
 *
 * ```ts
 * const select = defineIntent<{ key: string }>("selection/select");
 * dispatch(select({ key: "row-3" }, "pointer"));
 * ```
 */
export function defineIntent<TPayload = void>(type: string): IntentFactory<TPayload> {
  const factory = ((payload: TPayload, source: InteractionSource = "program") => ({
    type,
    payload,
    source,
  })) as IntentFactory<TPayload>;
  Object.defineProperty(factory, "type", { value: type, enumerable: true });
  factory.match = (intent: Intent): intent is Intent<TPayload> => intent.type === type;
  return factory;
}
