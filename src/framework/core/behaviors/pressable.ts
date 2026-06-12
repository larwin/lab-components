import { defineBehavior } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";
import { withEffects } from "../runtime/machine";
import type { FocusableSlice } from "./focusable";

/**
 * Pressable — unified activation across pointer, touch, pen and keyboard.
 * Button = Focusable + Pressable. The actual user callback is *not* called
 * here: activation produces an `event/emit press` effect, and the adapter maps
 * it to `onPress`. Pure, replayable, testable without a browser.
 */

export interface PressableSlice {
  readonly pressed: boolean;
}

export const pressIntents = {
  start: defineIntent<void>("press/start"),
  end: defineIntent<void>("press/end"),
  cancel: defineIntent<void>("press/cancel"),
  /** Immediate activation (keyboard shortcut, programmatic click). */
  activate: defineIntent<void>("press/activate"),
};

export const pressable = defineBehavior<"pressable", PressableSlice, object>({
  name: "pressable",
  initial: () => ({ pressed: false }),
  handlers: {
    [pressIntents.start.type]: (slice, _intent, ctx) => {
      const focus = ctx.read<FocusableSlice>("focusable");
      if (focus?.disabled) return slice;
      return slice.pressed ? slice : { ...slice, pressed: true };
    },
    [pressIntents.end.type]: (slice, intent, ctx) => {
      const focus = ctx.read<FocusableSlice>("focusable");
      if (!slice.pressed || focus?.disabled) return { pressed: false };
      return withEffects(
        { pressed: false },
        emitEvent({ name: "press", detail: { source: intent.source } }),
      );
    },
    [pressIntents.cancel.type]: (slice) => (slice.pressed ? { pressed: false } : slice),
    [pressIntents.activate.type]: (slice, intent, ctx) => {
      const focus = ctx.read<FocusableSlice>("focusable");
      if (focus?.disabled) return slice;
      return withEffects(slice, emitEvent({ name: "press", detail: { source: intent.source } }));
    },
  },
  keymap: () => [
    { keys: "Enter", intent: () => pressIntents.activate(undefined, "keyboard") },
    { keys: "Space", intent: () => pressIntents.activate(undefined, "keyboard") },
  ],
  aria: (slice) => ({
    "data-pressed": slice.pressed || undefined,
  }),
});
