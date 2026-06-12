import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  composeMachine,
  focusable,
  focusIntents,
  toggleable,
  toggleIntents,
  type ToggleableSlice,
} from "@/framework/core";
import { useComposedMachine, useForgeEffects, useKeymap, useLiveRef } from "@/framework/react";

/**
 * Toggle — a pressed/unpressed button. Same Toggleable machine as Checkbox,
 * with the `pressed` ARIA vocabulary (aria-pressed, no mixed state).
 */

export interface ToggleProps {
  children: ReactNode;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const toggleBehaviors = [focusable, toggleable] as const;

export function Toggle({
  children,
  pressed,
  defaultPressed,
  onPressedChange,
  disabled = false,
  className,
  ...rest
}: ToggleProps) {
  const live = useLiveRef({ onPressedChange, disabled });

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("toggle", toggleBehaviors, {
      defaultChecked: pressed ?? defaultPressed ?? false,
      ariaAttribute: "pressed" as const,
      get disabled() {
        return live.current.disabled;
      },
    }),
  );

  const isPressed = (state.toggleable as ToggleableSlice).checked === true;

  useEffect(() => {
    if (pressed !== undefined && pressed !== isPressed) {
      dispatch(toggleIntents.set({ checked: pressed }, "program"));
    }
  }, [pressed, isPressed, dispatch]);

  useEffect(() => {
    dispatch(focusIntents.setDisabled({ disabled }, "program"));
  }, [disabled, dispatch]);

  useForgeEffects(store, {
    events: {
      change: (detail) =>
        live.current.onPressedChange?.((detail as { checked: boolean }).checked === true),
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={rest["aria-label"]}
      {...composed.aria(state)}
      // Space goes through the keymap (prevented); Enter is the native click.
      onKeyDown={onKeyDown}
      onClick={(e) =>
        dispatch(toggleIntents.toggle(undefined, e.detail === 0 ? "keyboard" : "pointer"))
      }
      onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium transition-colors outline-none",
        "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        isPressed && "border-primary/40 bg-accent text-accent-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
