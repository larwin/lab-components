import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  composeMachine,
  focusable,
  focusIntents,
  formatNumber,
  numberIntents,
  numericValue,
  parseNumber,
  validatable,
  validityIntents,
  type AriaProps,
  type NumericValueSlice,
  type ValidatableSlice,
} from "@/framework/core";
import { useComposedMachine, useForgeEffects, useKeymap, useLiveRef } from "@/framework/react";
import { Field, fieldControlProps, useFieldContext, useFormField } from "./Field";

/**
 * NumberField — Focusable + NumericValue + Validatable. The machine owns the
 * numeric value (clamp/step/float-safety, Node-tested); the shell owns only
 * the text *draft* while typing, committed through `number/set` on blur or
 * Enter. Display and aria-valuetext go through Intl.NumberFormat; typed input
 * comes back through the locale-aware parser, so "1 234,56 €" round-trips.
 */

export interface NumberFieldProps {
  label: ReactNode;
  description?: ReactNode;
  value?: number | null;
  defaultValue?: number;
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shift+Arrow / PageUp / PageDown jump. Default 10 × step. */
  bigStep?: number;
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
  validate?: (value: number | null) => string | null;
  required?: boolean;
  name?: string;
  disabled?: boolean;
  className?: string;
}

const numberFieldBehaviors = [focusable, numericValue, validatable] as const;

const STEP_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown"]);

export function NumberField({
  label,
  description,
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  step = 1,
  bigStep,
  locale = "fr-FR",
  formatOptions,
  validate,
  required = false,
  name,
  disabled = false,
  className,
}: NumberFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Raw text while the user types; null = display the formatted value. */
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const live = useLiveRef({
    onValueChange,
    validate,
    required,
    min,
    max,
    step,
    bigStep,
    locale,
    formatOptions,
  });

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("numberfield", numberFieldBehaviors, {
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
      defaultValue: value ?? defaultValue ?? null,
      get disabled() {
        return disabled;
      },
      getValueText: (v: number) => formatNumber(v, live.current.locale, live.current.formatOptions),
      getFieldValue: (read: <T>(n: string) => T | undefined) =>
        read<NumericValueSlice>("numeric")?.value ?? null,
      validate: (v: unknown) => {
        if (live.current.required && v === null) return "Ce champ est requis";
        return live.current.validate?.(v as number | null) ?? null;
      },
    } as never),
  );

  const numeric = state.numeric as NumericValueSlice;
  const validity = state.validatable as ValidatableSlice;

  // Controlled mode.
  useEffect(() => {
    if (value !== undefined && value !== numeric.value) {
      dispatch(numberIntents.set({ value }, "program"));
    }
  }, [value, numeric.value, dispatch]);

  useForgeEffects(store, {
    events: {
      change: (detail) => live.current.onValueChange?.((detail as { value: number | null }).value),
    },
  });

  useFormField({
    validate: () => {
      dispatch(validityIntents.touch(undefined, "program"));
      return (store.getState().validatable as ValidatableSlice).error;
    },
    focus: () => inputRef.current?.focus(),
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const commitDraft = (source: "keyboard" | "pointer" = "keyboard") => {
    const text = draftRef.current;
    if (text === null) return;
    setDraft(null);
    draftRef.current = null;
    const trimmed = text.trim();
    if (trimmed === "") {
      dispatch(numberIntents.set({ value: null }, source));
      return;
    }
    const parsed = parseNumber(trimmed, live.current.locale, live.current.formatOptions);
    // Unparseable input reverts to the last committed value, like native steppers.
    if (parsed !== null) dispatch(numberIntents.set({ value: parsed }, source));
  };

  const display =
    draft ?? (numeric.value !== null ? formatNumber(numeric.value, locale, formatOptions) : "");

  return (
    <Field
      label={label}
      description={description}
      error={validity.error}
      required={required}
      className={className}
    >
      <NumberFieldControl
        inputRef={inputRef}
        display={display}
        name={name}
        disabled={disabled}
        aria={composed.aria(state)}
        onChange={(text) => {
          setDraft(text);
          draftRef.current = text;
          dispatch(validityIntents.markDirty(undefined, "program"));
        }}
        onKeyDown={(e) => {
          // Stepping or submitting first folds the draft into the machine.
          if (e.key === "Enter" || (STEP_KEYS.has(e.key) && draftRef.current !== null)) {
            commitDraft();
          }
          onKeyDown(e);
        }}
        onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
        onBlur={() => {
          commitDraft();
          dispatch(validityIntents.touch(undefined, "program"));
          dispatch(focusIntents.blur(undefined));
        }}
        onStep={(direction) =>
          dispatch(
            direction === 1
              ? numberIntents.increment(undefined, "pointer")
              : numberIntents.decrement(undefined, "pointer"),
          )
        }
      />
    </Field>
  );
}

interface NumberFieldControlProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  display: string;
  name?: string;
  disabled: boolean;
  aria: AriaProps;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  onBlur: () => void;
  onStep: (direction: 1 | -1) => void;
}

function NumberFieldControl({
  inputRef,
  display,
  name,
  disabled,
  aria,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  onStep,
}: NumberFieldControlProps) {
  const field = useFieldContext();
  return (
    <div
      className={cn(
        "flex h-9 w-full items-stretch overflow-hidden rounded-md border border-border bg-surface transition-colors",
        "focus-within:ring-2 focus-within:ring-ring",
        field?.invalid && "border-destructive focus-within:ring-destructive",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <StepperButton direction={-1} disabled={disabled} onStep={onStep}>
        <Minus className="size-3.5" />
      </StepperButton>
      <input
        ref={inputRef}
        role="spinbutton"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        name={name}
        disabled={disabled}
        {...aria}
        {...fieldControlProps(field)}
        tabIndex={undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        className="w-full min-w-0 flex-1 bg-transparent px-3 text-center text-sm tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <StepperButton direction={1} disabled={disabled} onStep={onStep}>
        <Plus className="size-3.5" />
      </StepperButton>
    </div>
  );
}

function StepperButton({
  direction,
  disabled,
  onStep,
  children,
}: {
  direction: 1 | -1;
  disabled: boolean;
  onStep: (direction: 1 | -1) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // Out of the tab order: arrow keys already step from the input (APG).
      tabIndex={-1}
      aria-label={direction === 1 ? "Incrémenter" : "Décrémenter"}
      disabled={disabled}
      onClick={() => onStep(direction)}
      className="flex w-9 shrink-0 items-center justify-center border-border text-muted-foreground transition-colors first:border-r last:border-l hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
