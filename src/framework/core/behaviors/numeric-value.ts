import { defineBehavior, type BehaviorContext, type KeyBinding } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";
import { withEffects, type TransitionResult } from "../runtime/machine";
import type { FocusableSlice } from "./focusable";

/**
 * NumericValue — a clamped, stepped numeric value.
 *
 * One behavior serves both spinbuttons (NumberField) and sliders: the math
 * (clamp, snap-to-step, float-safe rounding) is identical; only the keymap
 * profile differs. Keyboard, pointer drag and stepper buttons all converge on
 * the same intents — the journal shows which source moved the value.
 */

export interface NumericValueSlice {
  /** `null` = empty (a cleared NumberField). Sliders never go null. */
  readonly value: number | null;
}

export interface NumericValueConfig {
  min?: number;
  max?: number;
  /** Increment granularity. Default 1. */
  step?: number;
  /** Large jump (Shift+Arrow, PageUp/PageDown). Default 10 × step. */
  bigStep?: number;
  defaultValue?: number | null;
  /**
   * Keymap profile. "spinbutton" (default) binds ArrowUp/Down only — a text
   * input needs Left/Right/Home/End for the caret. "slider" adds
   * ArrowRight/Left and Home/End → min/max.
   */
  keys?: "spinbutton" | "slider";
  /** Human-readable value for aria-valuetext (e.g. "42 %", "3,50 €"). */
  getValueText?: (value: number) => string;
}

export const numberIntents = {
  /** Set directly (typed value, pointer drag). `snap` rounds onto the step grid. */
  set: defineIntent<{ value: number | null; snap?: boolean }>("number/set"),
  increment: defineIntent<{ large?: boolean } | void>("number/increment"),
  decrement: defineIntent<{ large?: boolean } | void>("number/decrement"),
  toMin: defineIntent<void>("number/to-min"),
  toMax: defineIntent<void>("number/to-max"),
};

/* Float-safe arithmetic: 0.1 + 0.2 must not surface as 0.30000000000000004. */
const decimalsOf = (n: number): number => {
  const text = String(n);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
};

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

type Ctx = BehaviorContext<NumericValueConfig>;

const clamp = (value: number, ctx: Ctx): number => {
  const { min, max } = ctx.config;
  let v = value;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return v;
};

const snapToStep = (value: number, ctx: Ctx): number => {
  const step = ctx.config.step ?? 1;
  const origin = ctx.config.min ?? 0;
  const decimals = Math.max(decimalsOf(step), decimalsOf(origin));
  return roundTo(origin + Math.round((value - origin) / step) * step, decimals);
};

const commit = (
  slice: NumericValueSlice,
  value: number | null,
  ctx: Ctx,
): TransitionResult<NumericValueSlice> => {
  if (ctx.read<FocusableSlice>("focusable")?.disabled) return slice;
  const next = value === null ? null : clamp(value, ctx);
  if (next === slice.value) return slice;
  return withEffects({ value: next }, emitEvent({ name: "change", detail: { value: next } }));
};

const stepBy = (
  slice: NumericValueSlice,
  direction: 1 | -1,
  large: boolean,
  ctx: Ctx,
): TransitionResult<NumericValueSlice> => {
  const step = ctx.config.step ?? 1;
  const delta = (large ? (ctx.config.bigStep ?? step * 10) : step) * direction;
  // Stepping an empty field starts from min (or 0), like native spinbuttons.
  const base = slice.value ?? ctx.config.min ?? 0;
  const decimals = Math.max(decimalsOf(step), decimalsOf(delta), decimalsOf(base));
  return commit(slice, roundTo(base + delta, decimals), ctx);
};

const largeOf = (payload: unknown): boolean => (payload as { large?: boolean })?.large === true;

export const numericValue = defineBehavior<"numeric", NumericValueSlice, NumericValueConfig>({
  name: "numeric",
  initial: (config) => ({ value: config.defaultValue ?? null }),
  handlers: {
    [numberIntents.set.type]: (slice, intent, ctx) => {
      const { value, snap } = intent.payload as { value: number | null; snap?: boolean };
      const snapped = snap && value !== null ? snapToStep(value, ctx) : value;
      return commit(slice, snapped, ctx);
    },
    [numberIntents.increment.type]: (slice, intent, ctx) =>
      stepBy(slice, 1, largeOf(intent.payload), ctx),
    [numberIntents.decrement.type]: (slice, intent, ctx) =>
      stepBy(slice, -1, largeOf(intent.payload), ctx),
    [numberIntents.toMin.type]: (slice, _intent, ctx) =>
      ctx.config.min === undefined ? slice : commit(slice, ctx.config.min, ctx),
    [numberIntents.toMax.type]: (slice, _intent, ctx) =>
      ctx.config.max === undefined ? slice : commit(slice, ctx.config.max, ctx),
  },
  keymap: (_slice, ctx) => {
    const bindings: KeyBinding[] = [
      { keys: "ArrowUp", intent: () => numberIntents.increment(undefined, "keyboard") },
      { keys: "ArrowDown", intent: () => numberIntents.decrement(undefined, "keyboard") },
      {
        keys: "Shift+ArrowUp",
        intent: () => numberIntents.increment({ large: true }, "keyboard"),
      },
      {
        keys: "Shift+ArrowDown",
        intent: () => numberIntents.decrement({ large: true }, "keyboard"),
      },
      { keys: "PageUp", intent: () => numberIntents.increment({ large: true }, "keyboard") },
      { keys: "PageDown", intent: () => numberIntents.decrement({ large: true }, "keyboard") },
    ];
    if (ctx.config.keys === "slider") {
      bindings.push(
        { keys: "ArrowRight", intent: () => numberIntents.increment(undefined, "keyboard") },
        { keys: "ArrowLeft", intent: () => numberIntents.decrement(undefined, "keyboard") },
        {
          keys: "Shift+ArrowRight",
          intent: () => numberIntents.increment({ large: true }, "keyboard"),
        },
        {
          keys: "Shift+ArrowLeft",
          intent: () => numberIntents.decrement({ large: true }, "keyboard"),
        },
        { keys: "Home", intent: () => numberIntents.toMin(undefined, "keyboard") },
        { keys: "End", intent: () => numberIntents.toMax(undefined, "keyboard") },
      );
    }
    return bindings;
  },
  aria: (slice, ctx) => ({
    "aria-valuemin": ctx.config.min,
    "aria-valuemax": ctx.config.max,
    "aria-valuenow": slice.value ?? undefined,
    "aria-valuetext":
      slice.value !== null && ctx.config.getValueText
        ? ctx.config.getValueText(slice.value)
        : undefined,
  }),
});
