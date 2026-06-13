import type { Store } from "@/framework/core/runtime/store";

import type { CampaignFormModel, CategoryId, Field, Template } from "./model";
import type { CategoryState, FieldState, TemplateState } from "./stores";

/**
 * Business services — pure TypeScript, no React. Both are registered as
 * `scoped`: they capture a snapshot of their store dependencies at construction
 * and do the EXPENSIVE work (compiling validators, building a templates-by-
 * category index) exactly once. The container rebuilds them only when a
 * dependency changes — never per call, never stale.
 *
 * `Telemetry` just counts builds so the demo can prove "rebuilt once per change"
 * on screen. A real service would not carry it.
 */

export interface Telemetry {
  contactBuilds: number;
  campaignBuilds: number;
}
export const createTelemetry = (): Telemetry => ({ contactBuilds: 0, campaignBuilds: 0 });

export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}
export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
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

/* ---------- ContactService — depends on FieldStore ---------- */

export interface ContactService {
  readonly compiledAt: number;
  requiredFieldKeys(): readonly string[];
  validateCustomValues(values: Readonly<Record<string, string>>): ValidationResult;
}

export function createContactService(
  fieldStore: Store<FieldState>,
  telemetry: Telemetry,
): ContactService {
  telemetry.contactBuilds += 1;
  const fields = fieldStore.getState().all; // snapshot captured at build time
  const validators = compileValidators(fields); // expensive, done once

  return {
    compiledAt: telemetry.contactBuilds,
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

/* ---------- CampaignService — depends on Category + Template stores AND ContactService ---------- */

export interface CampaignService {
  readonly compiledAt: number;
  templatesForCategory(categoryId: CategoryId | ""): readonly Template[];
  validate(model: CampaignFormModel): ValidationResult;
}

export function createCampaignService(
  categoryStore: Store<CategoryState>,
  templateStore: Store<TemplateState>,
  contact: ContactService,
  telemetry: Telemetry,
): CampaignService {
  telemetry.campaignBuilds += 1;
  const categories = categoryStore.getState();
  const templates = templateStore.getState();

  // Expensive projection built once: templates grouped by category.
  const byCategory = new Map<CategoryId, Template[]>();
  for (const template of templates.all) {
    const list = byCategory.get(template.categoryId) ?? [];
    list.push(template);
    byCategory.set(template.categoryId, list);
  }

  return {
    compiledAt: telemetry.campaignBuilds,
    templatesForCategory: (categoryId) =>
      categoryId === "" ? [] : (byCategory.get(categoryId) ?? []),
    validate(model) {
      const issues: ValidationIssue[] = [];
      const name = model.name.trim();
      if (name === "") issues.push({ field: "name", message: "Campaign name is required" });
      else if (name.length < 3) issues.push({ field: "name", message: "At least 3 characters" });

      if (model.categoryId === "") issues.push({ field: "category", message: "Pick a category" });
      else if (!categories.byId.has(model.categoryId))
        issues.push({ field: "category", message: "Unknown or archived category" });

      if (model.templateId !== null) {
        const template = templates.byId.get(model.templateId);
        if (!template) issues.push({ field: "template", message: "Unknown template" });
        else if (model.categoryId !== "" && template.categoryId !== model.categoryId)
          issues.push({ field: "template", message: "Template does not belong to that category" });
      }

      // Custom-field rules are delegated to ContactService — this is the
      // service→service edge that makes CampaignService rebuild whenever the
      // fields (and thus ContactService) change.
      const custom = contact.validateCustomValues(model.customValues);
      return { ok: issues.length === 0 && custom.ok, issues: [...issues, ...custom.issues] };
    },
  };
}
