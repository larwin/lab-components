import { defineBehavior } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";
import { withEffects } from "../runtime/machine";
import type { FocusableSlice } from "./focusable";

/**
 * Toggleable — checked/unchecked/mixed state.
 * Checkbox = Focusable + Toggleable. Switch = same with a different role.
 */

export type CheckedState = boolean | "mixed";

export interface ToggleableSlice {
  readonly checked: CheckedState;
}

export interface ToggleableConfig {
  defaultChecked?: CheckedState;
}

export const toggleIntents = {
  toggle: defineIntent<void>("toggle/toggle"),
  set: defineIntent<{ checked: CheckedState }>("toggle/set"),
};

export const toggleable = defineBehavior<"toggleable", ToggleableSlice, ToggleableConfig>({
  name: "toggleable",
  initial: (config) => ({ checked: config.defaultChecked ?? false }),
  handlers: {
    [toggleIntents.toggle.type]: (slice, _intent, ctx) => {
      if (ctx.read<FocusableSlice>("focusable")?.disabled) return slice;
      // mixed → checked, like the native indeterminate checkbox.
      const checked = slice.checked === "mixed" ? true : !slice.checked;
      return withEffects({ checked }, emitEvent({ name: "change", detail: { checked } }));
    },
    [toggleIntents.set.type]: (slice, intent) => {
      const { checked } = intent.payload as { checked: CheckedState };
      if (checked === slice.checked) return slice;
      return withEffects({ checked }, emitEvent({ name: "change", detail: { checked } }));
    },
  },
  keymap: () => [{ keys: "Space", intent: () => toggleIntents.toggle(undefined, "keyboard") }],
  aria: (slice) => ({
    "aria-checked": slice.checked === "mixed" ? "mixed" : slice.checked,
    "data-checked": slice.checked === true || undefined,
  }),
});
