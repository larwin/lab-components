import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  composeMachine,
  focusable,
  focusIntents,
  numberIntents,
  numericValue,
  type NumericValueSlice,
} from "@/framework/core";
import { useComposedMachine, useForgeEffects, useKeymap, useLiveRef } from "@/framework/react";
import { fieldControlProps, useFieldContext } from "./Field";

/**
 * Rating — zero new behavior: the same NumericValue machine as Slider (slider
 * keymap profile: arrows on both axes, Home/End → 0/max) rendered as stars.
 * Pointer clicks are geometry only — the left half of a star maps to the
 * half-step value when `step` is 0.5 — and converge on the same `number/set`
 * intent as the keyboard. `aria-valuetext` speaks « 3 étoiles sur 5 ».
 */

export interface RatingProps {
  /** Number of stars. */
  max?: number;
  /** 1 = whole stars, 0.5 = half stars. */
  step?: 1 | 0.5;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  disabled?: boolean;
  /** Human-readable value (aria-valuetext). Default « n étoile(s) sur max ». */
  formatValue?: (value: number, max: number) => string;
  className?: string;
  "aria-label"?: string;
}

const ratingBehaviors = [focusable, numericValue] as const;

const defaultFormat = (value: number, max: number) =>
  `${value} étoile${value >= 2 ? "s" : ""} sur ${max}`;

export function Rating({
  max = 5,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  formatValue = defaultFormat,
  className,
  ...rest
}: RatingProps) {
  const field = useFieldContext();
  const live = useLiveRef({ max, step, onValueChange, formatValue, disabled });

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("rating", ratingBehaviors, {
      min: 0,
      get max() {
        return live.current.max;
      },
      get step() {
        return live.current.step;
      },
      defaultValue: value ?? defaultValue ?? 0,
      keys: "slider" as const,
      get disabled() {
        return live.current.disabled;
      },
      getValueText: (v: number) => live.current.formatValue(v, live.current.max),
    } as never),
  );

  const current = (state.numeric as NumericValueSlice).value ?? 0;

  useEffect(() => {
    if (value !== undefined && value !== current) {
      dispatch(numberIntents.set({ value }, "program"));
    }
  }, [value, current, dispatch]);

  useEffect(() => {
    dispatch(focusIntents.setDisabled({ disabled }, "program"));
  }, [disabled, dispatch]);

  useForgeEffects(store, {
    events: {
      change: (detail) => {
        const v = (detail as { value: number | null }).value;
        if (v !== null) live.current.onValueChange?.(v);
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  /** Click geometry: left half of a star = half step (when step is 0.5). */
  const valueFromClick = (starIndex: number, e: React.PointerEvent<HTMLElement>): number => {
    const full = starIndex + 1;
    if (live.current.step !== 0.5) return full;
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? starIndex + 0.5 : full;
  };

  return (
    <div
      role="slider"
      {...composed.aria(state)}
      {...fieldControlProps(field)}
      aria-label={field ? undefined : (rest["aria-label"] ?? "Note")}
      aria-orientation="horizontal"
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {Array.from({ length: max }, (_, i) => {
        const fillRatio = Math.min(1, Math.max(0, current - i));
        return (
          <span
            key={i}
            className="relative inline-block cursor-pointer p-0.5"
            onPointerDown={(e) => {
              const next = valueFromClick(i, e);
              // Clicking the current value again clears the rating.
              dispatch(numberIntents.set({ value: next === current ? 0 : next }, "pointer"));
            }}
          >
            <Star aria-hidden className="size-6 text-muted-foreground/40" />
            {fillRatio > 0 && (
              <span
                aria-hidden
                className="absolute inset-0 overflow-hidden p-0.5"
                style={{ width: `${fillRatio * 100}%` }}
              >
                <Star className="size-6 fill-warning text-warning" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
