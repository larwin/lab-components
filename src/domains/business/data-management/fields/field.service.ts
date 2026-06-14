import type { Store } from "@/framework/core/runtime/store";

import type { Telemetry } from "@/domains/technical/telemetry/telemetry";

import type { FieldState } from "./field.store";
import type { Field } from "./model";

/**
 * FieldService — `scoped` domain logic. Captures the FieldStore snapshot at
 * construction and compiles one validator per field ONCE. Rebuilt by the
 * container only when FieldStore changes. Pure: no React, no DOM.
 */
export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}
export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface FieldService {
  readonly compiledAt: number;
  requiredFieldKeys(): readonly string[];
  validateCustomValues(values: Readonly<Record<string, string>>): ValidationResult;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type FieldValidator = (value: string) => string | null;

/** "Expensive" compilation: one closure per field, built once at service creation. */
function compileValidators(fields: readonly Field[]): Map<string, FieldValidator> {
  const validators = new Map<string, FieldValidator>();
  for (const field of fields) {
    validators.set(field.key, (raw) => {
      const value = raw.trim();
      if (field.required && value === "") return `${field.label} is required`;
      if (value === "") return null;
      if (field.type === "email" && !EMAIL_RE.test(value)) return `${field.label} must be an email`;
      if (field.type === "number" && Number.isNaN(Number(value)))
        return `${field.label} must be a number`;
      if (field.maxLength !== null && value.length > field.maxLength)
        return `${field.label} is too long (max ${field.maxLength})`;
      return null;
    });
  }
  return validators;
}

export function createFieldService(
  fieldStore: Store<FieldState>,
  telemetry: Telemetry,
): FieldService {
  telemetry.fieldServiceBuilds += 1;
  const fields = fieldStore.getState().all; // snapshot captured at build time
  const validators = compileValidators(fields); // expensive, done once

  return {
    compiledAt: telemetry.fieldServiceBuilds,
    requiredFieldKeys: () => fields.filter((f) => f.required).map((f) => f.key),
    validateCustomValues(values) {
      const issues: ValidationIssue[] = [];
      for (const [key, validate] of validators) {
        const message = validate(values[key] ?? "");
        if (message) issues.push({ field: key, message });
      }
      return { ok: issues.length === 0, issues };
    },
  };
}
