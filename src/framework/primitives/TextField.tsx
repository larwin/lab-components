import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  composeMachine,
  focusable,
  focusIntents,
  validatable,
  validityIntents,
  type AriaProps,
  type ValidatableSlice,
} from "@/framework/core";
import { useComposedMachine, useForgeEffects, useLiveRef } from "@/framework/react";
import { Field, fieldControlProps, useFieldContext, useFormField } from "./Field";

/**
 * TextField — a native input wrapped in Focusable + Validatable. Text editing
 * itself stays native (the browser's caret machine is fine); Forge adds the
 * validation lifecycle (dirty/touched/error, assertive announcements) and the
 * label/description/error wiring through Field. Validation runs on blur, then
 * live once the field has been touched.
 */

export interface TextFieldProps {
  label: ReactNode;
  description?: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Pure validator — also runs on Form submit. */
  validate?: (value: string) => string | null;
  required?: boolean;
  type?: "text" | "email" | "password" | "url" | "tel" | "search";
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}

const textFieldBehaviors = [focusable, validatable] as const;

export function TextField({
  label,
  description,
  value,
  defaultValue,
  onValueChange,
  validate,
  required = false,
  type = "text",
  placeholder,
  name,
  disabled = false,
  className,
}: TextFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const currentValue = value ?? uncontrolled;

  // Mirror updated synchronously on change, so a validate dispatched in the
  // same tick reads the fresh value (live refs only update on re-render).
  const valueRef = useRef(currentValue);
  valueRef.current = currentValue;

  const live = useLiveRef({ onValueChange, validate, required });

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("textfield", textFieldBehaviors, {
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

  useForgeEffects(store, { events: {} });

  useFormField({
    validate: () => {
      dispatch(validityIntents.touch(undefined, "program"));
      return (store.getState().validatable as ValidatableSlice).error;
    },
    focus: () => inputRef.current?.focus(),
  });

  const handleChange = (next: string) => {
    if (value === undefined) setUncontrolled(next);
    valueRef.current = next;
    live.current.onValueChange?.(next);
    dispatch(validityIntents.markDirty(undefined, "program"));
    // Live re-validation only after first blur — no yelling while typing.
    if (validity.touched) dispatch(validityIntents.validate(undefined, "program"));
  };

  return (
    <Field
      label={label}
      description={description}
      error={validity.error}
      required={required}
      className={className}
    >
      <TextFieldInput
        inputRef={inputRef}
        type={type}
        value={currentValue}
        placeholder={placeholder}
        name={name}
        disabled={disabled}
        aria={composed.aria(state)}
        onChange={handleChange}
        onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
        onBlur={() => {
          dispatch(validityIntents.touch(undefined, "program"));
          dispatch(focusIntents.blur(undefined));
        }}
      />
    </Field>
  );
}

interface TextFieldInputProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  type: string;
  value: string;
  placeholder?: string;
  name?: string;
  disabled: boolean;
  aria: AriaProps;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

/** Separate component so it reads the FieldContext that TextField provides. */
function TextFieldInput({
  inputRef,
  type,
  value,
  placeholder,
  name,
  disabled,
  aria,
  onChange,
  onFocus,
  onBlur,
}: TextFieldInputProps) {
  const field = useFieldContext();
  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      placeholder={placeholder}
      name={name}
      disabled={disabled}
      {...aria}
      {...fieldControlProps(field)}
      tabIndex={undefined}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm transition-colors outline-none",
        "placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive",
      )}
    />
  );
}
