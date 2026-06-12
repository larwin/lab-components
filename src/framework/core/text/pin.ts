import { createMachine, withEffects, type Machine } from "../runtime/machine";
import { defineIntent } from "../runtime/intent";
import { emitEvent, focusElement, type Effect } from "../runtime/effect";
import type { KeyBinding } from "../behaviors/behavior";

/**
 * PIN / OTP input — a dedicated pure machine (like gridMachine and the toast
 * queue): a segment cursor over N single-character slots.
 *
 * Typing writes the active segment and advances; Backspace clears the active
 * segment or, when it is already empty, steps back and clears; paste sanitizes
 * the clipboard (TSV, spaced or dashed codes) and distributes from the cursor.
 * Moving the cursor emits a declarative `dom/focus-element` effect whose
 * target is the segment index — the adapter maps it to the real input. When
 * the last empty slot fills, a `complete` event fires once (auto-submit is the
 * adapter's choice).
 */

export type PinKind = "numeric" | "alphanumeric";

export interface PinState {
  /** One single-character string per segment ("" = empty). */
  readonly values: readonly string[];
  /** Active segment index, 0-based. */
  readonly cursor: number;
}

export interface PinConfig {
  /** Number of segments. Default 6 (OTP). */
  length?: number;
  /** Accepted characters. Default "numeric". */
  kind?: PinKind;
}

export const pinIntents = {
  /** Type one character into the active segment (overwrites, then advances). */
  input: defineIntent<{ char: string }>("pin/input"),
  /** Clear the active segment, or step back and clear when already empty. */
  backspace: defineIntent<void>("pin/backspace"),
  /** Clear the active segment without moving (Delete). */
  deleteForward: defineIntent<void>("pin/delete"),
  /** Distribute sanitized clipboard text from the active segment. */
  paste: defineIntent<{ text: string }>("pin/paste"),
  /** Move the cursor by one segment (arrows). */
  move: defineIntent<{ direction: 1 | -1 }>("pin/move"),
  /** Set the cursor directly (pointer click on a segment, Home/End). */
  focusSegment: defineIntent<{ index: number }>("pin/focus-segment"),
  /** Reset every segment and return to the first one. */
  clear: defineIntent<void>("pin/clear"),
};

const accepts = (char: string, kind: PinKind): boolean =>
  char.length === 1 && (kind === "numeric" ? /[0-9]/.test(char) : /[0-9a-zA-Z]/.test(char));

/** Strip separators/garbage from pasted text, keep only accepted characters. */
export const sanitizePinText = (text: string, kind: PinKind): string[] =>
  [...text].filter((char) => accepts(char, kind));

const isComplete = (values: readonly string[]): boolean => values.every((v) => v !== "");

export function createPinMachine(config: PinConfig = {}): Machine<PinState> {
  const length = config.length ?? 6;
  const kind = config.kind ?? "numeric";
  const clampIndex = (index: number) => Math.min(length - 1, Math.max(0, index));

  /**
   * change + (once) complete + focus effects for a value transition.
   * Program-sourced intents (controlled-value sync) never move DOM focus.
   */
  const valueEffects = (prev: PinState, next: PinState, source: string): Effect[] => {
    const effects: Effect[] = [];
    if (next.values !== prev.values) {
      const value = next.values.join("");
      effects.push(emitEvent({ name: "change", detail: { value } }));
      if (isComplete(next.values) && !isComplete(prev.values)) {
        effects.push(emitEvent({ name: "complete", detail: { value } }));
      }
    }
    if (next.cursor !== prev.cursor && source !== "program") {
      effects.push(focusElement({ target: String(next.cursor) }));
    }
    return effects;
  };

  return createMachine<PinState>({
    id: "pin",
    initialState: { values: Array.from({ length }, () => ""), cursor: 0 },
    handlers: {
      [pinIntents.input.type]: (state, intent) => {
        const { char } = intent.payload as { char: string };
        if (!accepts(char, kind)) return state;
        const values = state.values.map((v, i) => (i === state.cursor ? char : v));
        const next: PinState = { values, cursor: clampIndex(state.cursor + 1) };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [pinIntents.backspace.type]: (state, intent) => {
        if (state.values[state.cursor] !== "") {
          const values = state.values.map((v, i) => (i === state.cursor ? "" : v));
          const next: PinState = { ...state, values };
          return withEffects(next, ...valueEffects(state, next, intent.source));
        }
        if (state.cursor === 0) return state;
        const cursor = state.cursor - 1;
        const values =
          state.values[cursor] === ""
            ? state.values
            : state.values.map((v, i) => (i === cursor ? "" : v));
        const next: PinState = { values, cursor };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [pinIntents.deleteForward.type]: (state, intent) => {
        if (state.values[state.cursor] === "") return state;
        const values = state.values.map((v, i) => (i === state.cursor ? "" : v));
        const next: PinState = { ...state, values };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [pinIntents.paste.type]: (state, intent) => {
        const { text } = intent.payload as { text: string };
        const chars = sanitizePinText(text, kind);
        if (chars.length === 0) return state;
        const values = state.values.map((v, i) => {
          const offset = i - state.cursor;
          return offset >= 0 && offset < chars.length ? chars[offset] : v;
        });
        const written = Math.min(chars.length, length - state.cursor);
        const next: PinState = { values, cursor: clampIndex(state.cursor + written) };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [pinIntents.move.type]: (state, intent) => {
        const { direction } = intent.payload as { direction: 1 | -1 };
        const cursor = clampIndex(state.cursor + direction);
        if (cursor === state.cursor) return state;
        const next: PinState = { ...state, cursor };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [pinIntents.focusSegment.type]: (state, intent) => {
        const index = clampIndex((intent.payload as { index: number }).index);
        if (index === state.cursor) return state;
        const next: PinState = { ...state, cursor: index };
        // Pointer clicks already moved DOM focus; keyboard (Home/End) needs the effect.
        if (intent.source === "pointer") return next;
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },

      [pinIntents.clear.type]: (state, intent) => {
        const dirty = state.values.some((v) => v !== "");
        if (!dirty && state.cursor === 0) return state;
        const next: PinState = {
          values: Array.from({ length }, () => ""),
          cursor: 0,
        };
        return withEffects(next, ...valueEffects(state, next, intent.source));
      },
    },
  });
}

/** Declarative keymap for the segment inputs (resolved by the adapter). */
export function pinKeymap(config: PinConfig = {}): KeyBinding[] {
  const kind = config.kind ?? "numeric";
  const length = config.length ?? 6;
  return [
    {
      keys: "@printable",
      intent: (stroke) =>
        accepts(stroke.key, kind) ? pinIntents.input({ char: stroke.key }, "keyboard") : null,
    },
    { keys: "Backspace", intent: () => pinIntents.backspace(undefined, "keyboard") },
    { keys: "Delete", intent: () => pinIntents.deleteForward(undefined, "keyboard") },
    { keys: "ArrowLeft", intent: () => pinIntents.move({ direction: -1 }, "keyboard") },
    { keys: "ArrowRight", intent: () => pinIntents.move({ direction: 1 }, "keyboard") },
    { keys: "Home", intent: () => pinIntents.focusSegment({ index: 0 }, "keyboard") },
    { keys: "End", intent: () => pinIntents.focusSegment({ index: length - 1 }, "keyboard") },
  ];
}
