import { useEffect, useRef } from "react";
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
 * Slider — the same NumericValue machine as NumberField with the slider keymap
 * profile (arrows on both axes, Home/End → min/max, PageUp/Down big jumps).
 * Pointer drag is just geometry: the shell converts clientX to a raw value and
 * dispatches the very same `number/set` intent with snap-to-step — keyboard
 * and pointer are indistinguishable in the journal except for their source.
 */

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Human-readable value (aria-valuetext + the value badge). */
  formatValue?: (value: number) => string;
  showValue?: boolean;
  disabled?: boolean;
  /**
   * Styling slot for the track (gradient hue/alpha rails). When set, the
   * filled-portion bar is not rendered. Machine untouched.
   */
  trackStyle?: React.CSSProperties;
  className?: string;
  "aria-label"?: string;
}

const sliderBehaviors = [focusable, numericValue] as const;

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  bigStep,
  value,
  defaultValue,
  onValueChange,
  formatValue,
  showValue = true,
  disabled = false,
  trackStyle,
  className,
  ...rest
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const field = useFieldContext();
  const live = useLiveRef({ min, max, step, bigStep, onValueChange, formatValue, disabled });

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("slider", sliderBehaviors, {
      get min() {
        return live.current.min;
      },
      get max() {
        return live.current.max;
      },
      get step() {
        return live.current.step;
      },
      get bigStep() {
        return live.current.bigStep;
      },
      defaultValue: value ?? defaultValue ?? min,
      keys: "slider" as const,
      get disabled() {
        return live.current.disabled;
      },
      getValueText: (v: number) => live.current.formatValue?.(v) ?? String(v),
    } as never),
  );

  const current = (state.numeric as NumericValueSlice).value ?? min;

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

  const valueFromPointer = (clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return live.current.min + ratio * (live.current.max - live.current.min);
  };

  const dispatchPointer = (clientX: number) => {
    const raw = valueFromPointer(clientX);
    if (raw !== null) dispatch(numberIntents.set({ value: raw, snap: true }, "pointer"));
  };

  const ratio = max === min ? 0 : (current - min) / (max - min);
  const label = formatValue?.(current) ?? String(current);

  return (
    <div className={cn("flex w-full max-w-sm items-center gap-3", className)}>
      <div
        ref={trackRef}
        className={cn(
          "relative h-5 flex-1 cursor-pointer touch-none",
          disabled && "pointer-events-none opacity-50",
        )}
        onPointerDown={(e) => {
          if (live.current.disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dispatchPointer(e.clientX);
          // Drag puts DOM focus on the thumb so keyboard can take over.
          (e.currentTarget.querySelector("[role=slider]") as HTMLElement | null)?.focus();
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) dispatchPointer(e.clientX);
        }}
      >
        <div
          className={cn(
            "absolute top-1/2 w-full -translate-y-1/2 rounded-full",
            trackStyle ? "h-3 border border-border/60" : "h-1.5 bg-muted",
          )}
          style={trackStyle}
        />
        {!trackStyle && (
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
            style={{ width: `${ratio * 100}%` }}
          />
        )}
        <div
          role="slider"
          {...composed.aria(state)}
          {...fieldControlProps(field)}
          aria-label={field ? undefined : (rest["aria-label"] ?? "Valeur")}
          aria-orientation="horizontal"
          aria-disabled={disabled || undefined}
          onKeyDown={onKeyDown}
          onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
          onBlur={() => dispatch(focusIntents.blur(undefined))}
          className={cn(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-surface shadow-sm transition-shadow outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
      {showValue && (
        <span className="min-w-12 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {label}
        </span>
      )}
    </div>
  );
}
