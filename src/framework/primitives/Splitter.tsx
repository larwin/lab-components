import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  composeMachine,
  focusable,
  focusIntents,
  numberIntents,
  numericValue,
  type NumericValueSlice,
} from "@/framework/core";
import { useComposedMachine, useForgeEffects, useKeymap, useLiveRef } from "@/framework/react";

/**
 * Splitter — two resizable panels around a draggable separator. The machine
 * is NumericValue once more (the drag machine models items between zones,
 * not a continuous ratio): the value is the first panel's share in %, drag
 * geometry and arrow keys converge on the same `number/set`/increment
 * intents, and `role="separator"` ARIA derives from the slice. Double-click
 * resets to the initial split.
 */

export interface SplitterProps {
  /** "horizontal" = panels side by side (vertical bar). */
  orientation?: "horizontal" | "vertical";
  /** First panel share, in % of the container. */
  defaultValue?: number;
  /** Min/max share of the first panel (%). */
  min?: number;
  max?: number;
  onValueChange?: (value: number) => void;
  children: [ReactNode, ReactNode];
  className?: string;
  "aria-label"?: string;
}

const splitterBehaviors = [focusable, numericValue] as const;

export function Splitter({
  orientation = "horizontal",
  defaultValue = 50,
  min = 15,
  max = 85,
  onValueChange,
  children,
  className,
  ...rest
}: SplitterProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const live = useLiveRef({ min, max, defaultValue, onValueChange, orientation });

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("splitter", splitterBehaviors, {
      get min() {
        return live.current.min;
      },
      get max() {
        return live.current.max;
      },
      step: 1,
      bigStep: 10,
      defaultValue,
      keys: "slider" as const,
      getValueText: (v: number) => `${Math.round(v)} % – ${Math.round(100 - v)} %`,
    } as never),
  );

  const value = (state.numeric as NumericValueSlice).value ?? defaultValue;
  const horizontal = orientation === "horizontal";

  useForgeEffects(store, {
    events: {
      change: (detail) => {
        const v = (detail as { value: number | null }).value;
        if (v !== null) live.current.onValueChange?.(v);
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const dispatchPointer = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio =
      live.current.orientation === "horizontal"
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
    if (Number.isFinite(ratio)) {
      dispatch(numberIntents.set({ value: ratio * 100, snap: true }, "pointer"));
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full w-full", horizontal ? "flex-row" : "flex-col", className)}
    >
      <div
        style={{ flexBasis: `${value}%` }}
        className="min-h-0 min-w-0 shrink-0 grow-0 overflow-auto"
      >
        {children[0]}
      </div>
      <div
        role="separator"
        tabIndex={0}
        {...composed.aria(state)}
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        aria-label={rest["aria-label"] ?? "Redimensionner les panneaux"}
        onKeyDown={onKeyDown}
        onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
        onBlur={() => dispatch(focusIntents.blur(undefined))}
        onDoubleClick={() =>
          dispatch(numberIntents.set({ value: live.current.defaultValue }, "pointer"))
        }
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) dispatchPointer(e);
        }}
        className={cn(
          "group relative z-10 flex shrink-0 items-center justify-center outline-none",
          horizontal ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
          "bg-border transition-colors hover:bg-ring/60",
          "focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "rounded-full bg-muted-foreground/50 group-hover:bg-muted-foreground",
            horizontal ? "h-8 w-0.5" : "h-0.5 w-8",
          )}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children[1]}</div>
    </div>
  );
}
