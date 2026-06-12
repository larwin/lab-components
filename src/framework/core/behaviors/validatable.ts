import { defineBehavior } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { announce, emitEvent, type Effect } from "../runtime/effect";
import { withEffects, type TransitionResult } from "../runtime/machine";

/**
 * Validatable — dirty/touched/error lifecycle for form controls.
 *
 * The validator is pure config; the value is read either from a sibling slice
 * (pure composed machines) or from the adapter (controlled inputs) through
 * `getFieldValue`. A new error is announced assertively to screen readers as a
 * declarative effect — the adapter's live region does the talking.
 *
 * Composes into TextField, NumberField and the Form/Field wiring.
 */

export interface ValidatableSlice {
  readonly dirty: boolean;
  readonly touched: boolean;
  readonly error: string | null;
}

export type Validator = (value: unknown) => string | null;

/** `read` is the behavior context's sibling-slice reader. */
export type FieldValueReader = (read: <T>(behaviorName: string) => T | undefined) => unknown;

export interface ValidatableConfig {
  /** Reads the value to validate (sibling slice in core, live prop in React). */
  getFieldValue?: FieldValueReader;
  validate?: Validator;
}

export const validityIntents = {
  /** Run the configured validator against the current value. */
  validate: defineIntent<void>("validity/validate"),
  /** Back to pristine: not dirty, not touched, no error. */
  reset: defineIntent<void>("validity/reset"),
  /** The field lost focus at least once (blur). Also validates. */
  touch: defineIntent<void>("validity/touch"),
  /** The value changed at least once (input). */
  markDirty: defineIntent<void>("validity/mark-dirty"),
  /** External error (e.g. server-side rejection). `null` clears it. */
  setError: defineIntent<{ error: string | null }>("validity/set-error"),
};

const INITIAL: ValidatableSlice = { dirty: false, touched: false, error: null };

const applyError = (
  slice: ValidatableSlice,
  next: ValidatableSlice,
  error: string | null,
): TransitionResult<ValidatableSlice> => {
  if (error === slice.error && next === slice) return slice;
  const result = { ...next, error };
  const effects: Effect[] = [
    emitEvent({ name: "validityChange", detail: { error, valid: error === null } }),
  ];
  // Announce only *new* errors — clearing one stays quiet.
  if (error !== null && error !== slice.error) {
    effects.push(announce({ message: error, politeness: "assertive" }));
  }
  if (error === slice.error) return result;
  return withEffects(result, ...effects);
};

export const validatable = defineBehavior<"validatable", ValidatableSlice, ValidatableConfig>({
  name: "validatable",
  initial: () => INITIAL,
  handlers: {
    [validityIntents.validate.type]: (slice, _intent, ctx) => {
      const { validate, getFieldValue } = ctx.config;
      if (!validate) return slice;
      return applyError(slice, slice, validate(getFieldValue?.(ctx.read)));
    },
    [validityIntents.touch.type]: (slice, _intent, ctx) => {
      const next = slice.touched ? slice : { ...slice, touched: true };
      const { validate, getFieldValue } = ctx.config;
      if (!validate) return next;
      return applyError(slice, next, validate(getFieldValue?.(ctx.read)));
    },
    [validityIntents.markDirty.type]: (slice) => (slice.dirty ? slice : { ...slice, dirty: true }),
    [validityIntents.reset.type]: (slice) => {
      if (!slice.dirty && !slice.touched && slice.error === null) return slice;
      return withEffects(
        INITIAL,
        emitEvent({ name: "validityChange", detail: { error: null, valid: true } }),
      );
    },
    [validityIntents.setError.type]: (slice, intent) => {
      const { error } = intent.payload as { error: string | null };
      return applyError(slice, slice, error);
    },
  },
  aria: (slice) => ({
    "aria-invalid": slice.error !== null || undefined,
    "data-dirty": slice.dirty || undefined,
    "data-touched": slice.touched || undefined,
  }),
});
