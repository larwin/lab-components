import { useEffect, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  composeMachine,
  focusable,
  focusIntents,
  toggleable,
  toggleIntents,
  type CheckedState,
  type ToggleableSlice,
} from "@/framework/core";
import { useComposedMachine, useForgeEffects, useKeymap, useLiveRef } from "@/framework/react";
import { fieldControlProps, useFieldContext } from "./Field";

/**
 * Checkbox — Focusable + Toggleable, including the `mixed` state.
 * The machine was Node-tested before this shell existed; this file only
 * renders `aria-checked` and forwards Space/click as `toggle/toggle` intents.
 */

export interface CheckboxProps {
  /** Inline label (the button content names the control). */
  children?: ReactNode;
  /** Controlled state — `"mixed"` renders the indeterminate dash. */
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const checkboxBehaviors = [focusable, toggleable] as const;

export function Checkbox({
  children,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  className,
  ...rest
}: CheckboxProps) {
  const live = useLiveRef({ onCheckedChange, disabled });
  const field = useFieldContext();

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("checkbox", checkboxBehaviors, {
      defaultChecked: checked ?? defaultChecked ?? false,
      get disabled() {
        return live.current.disabled;
      },
    }),
  );

  const machineChecked = (state.toggleable as ToggleableSlice).checked;

  // Controlled mode: the prop is the source of truth, the machine follows.
  useEffect(() => {
    if (checked !== undefined && checked !== machineChecked) {
      dispatch(toggleIntents.set({ checked }, "program"));
    }
  }, [checked, machineChecked, dispatch]);

  useEffect(() => {
    dispatch(focusIntents.setDisabled({ disabled }, "program"));
  }, [disabled, dispatch]);

  useForgeEffects(store, {
    events: {
      change: (detail) => live.current.onCheckedChange?.((detail as ToggleableSlice).checked),
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  return (
    <button
      type="button"
      role="checkbox"
      disabled={disabled}
      {...composed.aria(state)}
      {...fieldControlProps(field)}
      aria-label={rest["aria-label"]}
      onClick={() => dispatch(toggleIntents.toggle(undefined, "pointer"))}
      onKeyDown={(e) => {
        onKeyDown(e);
        // A native button also clicks on Enter — checkboxes only react to Space.
        if (e.key === "Enter") e.preventDefault();
      }}
      onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      className={cn(
        "group inline-flex items-center gap-2.5 text-sm outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4.5 shrink-0 items-center justify-center rounded border border-border bg-surface transition-colors",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
          machineChecked !== false && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {machineChecked === true && <Check className="size-3.5" strokeWidth={3} />}
        {machineChecked === "mixed" && <Minus className="size-3.5" strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
