import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  characterLimit,
  composeMachine,
  focusable,
  focusIntents,
  validatable,
  validityIntents,
  type AriaProps,
  type ValidatableSlice,
} from "@/framework/core";
import { announceNow, useComposedMachine, useForgeEffects, useLiveRef } from "@/framework/react";
import { Field, fieldControlProps, useFieldContext, useFormField } from "./Field";

/**
 * TextArea — the TextField recipe (Focusable + Validatable, native text
 * editing) on a multi-line control, plus two policies:
 *  - optional auto-resize (pure geometry, measured in the adapter);
 *  - a character counter wired to `maxLength` whose warning window comes from
 *    the pure `characterLimit` core — the SR announcement fires once when
 *    entering the window, through the shared live region.
 */

export interface TextAreaProps {
  label: ReactNode;
  description?: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Pure validator — also runs on Form submit. */
  validate?: (value: string) => string | null;
  required?: boolean;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  rows?: number;
  /** Enables the native limit + the visible counter + the SR warning. */
  maxLength?: number;
  /** Grow with the content (between `rows` and `maxRows`). */
  autoResize?: boolean;
  maxRows?: number;
  className?: string;
}

const textAreaBehaviors = [focusable, validatable] as const;

export function TextArea({
  label,
  description,
  value,
  defaultValue,
  onValueChange,
  validate,
  required = false,
  placeholder,
  name,
  disabled = false,
  rows = 3,
  maxLength,
  autoResize = false,
  maxRows = 10,
  className,
}: TextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const currentValue = value ?? uncontrolled;

  // Synchronous mirror so a validate dispatched in the same tick reads the
  // in-flight keystroke (live refs only refresh on re-render).
  const valueRef = useRef(currentValue);
  valueRef.current = currentValue;

  const live = useLiveRef({ onValueChange, validate, required });
  const wasWarning = useRef(false);

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("textarea", textAreaBehaviors, {
      get disabled() {
        return disabled;
      },
      getFieldValue: () => valueRef.current,
      validate: (v: unknown) => {
        const text = v as string;
        if (live.current.required && text.trim() === "") return "Ce champ est requis";
        return live.current.validate?.(text) ?? null;
      },
    }),
  );

  const validity = state.validatable as ValidatableSlice;
  const limit = maxLength !== undefined ? characterLimit(currentValue, maxLength) : null;

  useForgeEffects(store, { events: {} });

  useFormField({
    validate: () => {
      dispatch(validityIntents.touch(undefined, "program"));
      return (store.getState().validatable as ValidatableSlice).error;
    },
    focus: () => textareaRef.current?.focus(),
  });

  /* Auto-resize: measure scrollHeight, clamped between rows and maxRows. */
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!autoResize || !el) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = "auto";
    const max = maxRows * lineHeight;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [autoResize, maxRows, currentValue]);

  const handleChange = (next: string) => {
    if (value === undefined) setUncontrolled(next);
    valueRef.current = next;
    live.current.onValueChange?.(next);
    dispatch(validityIntents.markDirty(undefined, "program"));
    if (validity.touched) dispatch(validityIntents.validate(undefined, "program"));
    // Announce once when entering the warning window — leaving stays quiet.
    if (maxLength !== undefined) {
      const nextLimit = characterLimit(next, maxLength);
      if (nextLimit.warn && !wasWarning.current && nextLimit.message) {
        announceNow(nextLimit.message, "polite");
      }
      wasWarning.current = nextLimit.warn;
    }
  };

  return (
    <Field
      label={label}
      description={description}
      error={validity.error}
      required={required}
      className={className}
    >
      <TextAreaControl
        textareaRef={textareaRef}
        value={currentValue}
        placeholder={placeholder}
        name={name}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        aria={composed.aria(state)}
        onChange={handleChange}
        onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
        onBlur={() => {
          dispatch(validityIntents.touch(undefined, "program"));
          dispatch(focusIntents.blur(undefined));
        }}
      />
      {limit && (
        <div
          aria-hidden
          className={cn(
            "self-end font-mono text-[11px] tabular-nums",
            limit.overflow
              ? "font-semibold text-destructive"
              : limit.warn
                ? "text-warning"
                : "text-muted-foreground",
          )}
        >
          {limit.count} / {limit.max}
        </div>
      )}
    </Field>
  );
}

interface TextAreaControlProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  placeholder?: string;
  name?: string;
  disabled: boolean;
  rows: number;
  maxLength?: number;
  aria: AriaProps;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

/** Separate component so it reads the FieldContext that TextArea provides. */
function TextAreaControl({
  textareaRef,
  value,
  placeholder,
  name,
  disabled,
  rows,
  maxLength,
  aria,
  onChange,
  onFocus,
  onBlur,
}: TextAreaControlProps) {
  const field = useFieldContext();
  return (
    <textarea
      ref={textareaRef}
      value={value}
      placeholder={placeholder}
      name={name}
      disabled={disabled}
      rows={rows}
      maxLength={maxLength}
      {...aria}
      {...fieldControlProps(field)}
      tabIndex={undefined}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        "w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors outline-none",
        "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive",
      )}
    />
  );
}
