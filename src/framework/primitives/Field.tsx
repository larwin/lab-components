import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Form / Field — the accessibility wiring around any control.
 *
 * Field renders label + description + error message and exposes their ids
 * through context; controls (TextField, NumberField, Slider, …) pick them up
 * for `aria-labelledby` / `aria-describedby`. The error text itself is NOT a
 * live region: the machines' `a11y/announce` effect already speaks — rendering
 * is presentation only.
 *
 * Form keeps a registry of validatable fields: submit validates them all in
 * DOM order and focuses the first invalid one.
 */

/* ── Field context ────────────────────────────────────────────────────── */

export interface FieldContextValue {
  inputId: string;
  labelId: string;
  descriptionId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

/** Merged describedby/labelledby props for the control inside a Field. */
export function fieldControlProps(field: FieldContextValue | null): {
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
} {
  if (!field) return {};
  const describedBy = [field.descriptionId, field.errorId].filter(Boolean).join(" ");
  return {
    id: field.inputId,
    "aria-labelledby": field.labelId,
    "aria-describedby": describedBy || undefined,
  };
}

export interface FieldProps {
  label: ReactNode;
  description?: ReactNode;
  /** Validation error from the control's machine (`null` = valid). */
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  description,
  error = null,
  required = false,
  children,
  className,
}: FieldProps) {
  const baseId = useId();
  const value = useMemo<FieldContextValue>(
    () => ({
      inputId: `${baseId}-input`,
      labelId: `${baseId}-label`,
      descriptionId: description ? `${baseId}-description` : undefined,
      errorId: error ? `${baseId}-error` : undefined,
      invalid: error !== null,
      required,
    }),
    [baseId, description, error, required],
  );

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-1.5", className)}>
      <label id={value.labelId} htmlFor={value.inputId} className="text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </label>
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
      {description && (
        <p id={value.descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={value.errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Form registry ────────────────────────────────────────────────────── */

export interface FormFieldRegistration {
  /** Runs the field's validation and returns the resulting error. */
  validate(): string | null;
  focus(): void;
}

interface FormContextValue {
  register(field: FormFieldRegistration): () => void;
}

const FormContext = createContext<FormContextValue | null>(null);

/** Controls with a Validatable machine register themselves for submit-time validation. */
export function useFormField(registration: FormFieldRegistration | null): void {
  const form = useContext(FormContext);
  const ref = useRef(registration);
  ref.current = registration;
  useEffect(() => {
    if (!form || !ref.current) return;
    // Stable proxy so re-renders never re-register.
    return form.register({
      validate: () => ref.current?.validate() ?? null,
      focus: () => ref.current?.focus(),
    });
  }, [form]);
}

export interface FormProps {
  /** Called only when every registered field validates. */
  onSubmit?: () => void;
  children: ReactNode;
  className?: string;
}

export function Form({ onSubmit, children, className }: FormProps) {
  const fields = useRef(new Set<FormFieldRegistration>());

  const register = useCallback((field: FormFieldRegistration) => {
    fields.current.add(field);
    return () => void fields.current.delete(field);
  }, []);

  const context = useMemo<FormContextValue>(() => ({ register }), [register]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    let firstInvalid: FormFieldRegistration | null = null;
    for (const field of fields.current) {
      const error = field.validate();
      if (error !== null && firstInvalid === null) firstInvalid = field;
    }
    if (firstInvalid) firstInvalid.focus();
    else onSubmit?.();
  };

  return (
    <FormContext.Provider value={context}>
      <form noValidate onSubmit={handleSubmit} className={className}>
        {children}
      </form>
    </FormContext.Provider>
  );
}
