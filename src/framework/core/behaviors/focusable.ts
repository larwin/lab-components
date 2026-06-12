import { defineBehavior } from "./behavior";
import { defineIntent } from "../runtime/intent";

/**
 * Focusable — host focus tracking + disabled semantics.
 * Composes into virtually everything: Button, Checkbox, Listbox, Grid…
 */

export interface FocusableSlice {
  readonly focused: boolean;
  /** True only for keyboard-driven focus (drives :focus-visible styling). */
  readonly focusVisible: boolean;
  readonly disabled: boolean;
}

export interface FocusableConfig {
  disabled?: boolean;
}

export const focusIntents = {
  focus: defineIntent<{ visible?: boolean }>("focus/focus"),
  blur: defineIntent<void>("focus/blur"),
  setDisabled: defineIntent<{ disabled: boolean }>("focus/set-disabled"),
};

export const focusable = defineBehavior<"focusable", FocusableSlice, FocusableConfig>({
  name: "focusable",
  initial: (config) => ({
    focused: false,
    focusVisible: false,
    disabled: config.disabled ?? false,
  }),
  handlers: {
    [focusIntents.focus.type]: (slice, intent) => {
      if (slice.disabled) return slice;
      const { visible } = intent.payload as { visible?: boolean };
      const focusVisible = visible ?? intent.source === "keyboard";
      if (slice.focused && slice.focusVisible === focusVisible) return slice;
      return { ...slice, focused: true, focusVisible };
    },
    [focusIntents.blur.type]: (slice) =>
      slice.focused ? { ...slice, focused: false, focusVisible: false } : slice,
    [focusIntents.setDisabled.type]: (slice, intent) => {
      const { disabled } = intent.payload as { disabled: boolean };
      return slice.disabled === disabled ? slice : { ...slice, disabled };
    },
  },
  aria: (slice) => ({
    tabIndex: slice.disabled ? undefined : 0,
    "aria-disabled": slice.disabled || undefined,
  }),
});
