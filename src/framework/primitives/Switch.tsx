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
import { fieldControlProps, useFieldContext } from "./Field";

/**
 * Switch — the exact same machine as Checkbox (Focusable + Toggleable);
 * only `role="switch"` and the track/thumb visuals differ. That equivalence
 * is the composition model working as designed.
 */

export interface SwitchProps {
  children?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const switchBehaviors = [focusable, toggleable] as const;

export function Switch({
  children,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  className,
  ...rest
}: SwitchProps) {
  const live = useLiveRef({ onCheckedChange, disabled });
  const field = useFieldContext();

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("switch", switchBehaviors, {
      defaultChecked: checked ?? defaultChecked ?? false,
      get disabled() {
        return live.current.disabled;
      },
    }),
  );

  const on = (state.toggleable as ToggleableSlice).checked === true;

  useEffect(() => {
    if (checked !== undefined && checked !== on) {
      dispatch(toggleIntents.set({ checked }, "program"));
    }
  }, [checked, on, dispatch]);

  useEffect(() => {
    dispatch(focusIntents.setDisabled({ disabled }, "program"));
  }, [disabled, dispatch]);

  useForgeEffects(store, {
    events: {
      change: (detail) =>
        live.current.onCheckedChange?.((detail as { checked: boolean }).checked === true),
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      {...composed.aria(state)}
      {...fieldControlProps(field)}
      aria-label={rest["aria-label"]}
      onClick={() => dispatch(toggleIntents.toggle(undefined, "pointer"))}
      onKeyDown={(e) => {
        onKeyDown(e);
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
          "relative inline-flex h-5.5 w-9.5 shrink-0 rounded-full border border-transparent transition-colors",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background",
          on ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
            on && "translate-x-4",
          )}
        />
      </span>
      {children}
    </button>
  );
}
