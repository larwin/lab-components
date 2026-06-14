import type { Store } from "@/framework/core/runtime/store";

import type { CategoryId, CategoryState } from "@/domains/business/campaign/categories";
import type { CampaignDraft } from "@/domains/business/campaign/campaigns";
import type {
  FieldService,
  ValidationIssue,
  ValidationResult,
} from "@/domains/business/data-management/fields";
import type { Template, TemplateState } from "@/domains/business/campaign/templates";
import type { Telemetry } from "@/domains/technical/telemetry/telemetry";

/**
 * CampaignEditorService — APPLICATION orchestration (not a single domain). It
 * combines the Category + Template stores and delegates custom-field rules to
 * the fields domain's FieldService. `scoped`: rebuilt when any of those change.
 * This is the cross-domain logic RFC-003 §1.2 keeps OUT of any one domain.
 */
export interface CampaignEditorService {
  readonly compiledAt: number;
  templatesForCategory(categoryId: CategoryId | ""): readonly Template[];
  validate(draft: CampaignDraft): ValidationResult;
}

export function createCampaignEditorService(
  categoryStore: Store<CategoryState>,
  templateStore: Store<TemplateState>,
  field: FieldService,
  telemetry: Telemetry,
): CampaignEditorService {
  telemetry.editorServiceBuilds += 1;
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
    compiledAt: telemetry.editorServiceBuilds,
    templatesForCategory: (categoryId) =>
      categoryId === "" ? [] : (byCategory.get(categoryId) ?? []),
    validate(draft) {
      const issues: ValidationIssue[] = [];
      const name = draft.name.trim();
      if (name === "") issues.push({ field: "name", message: "Campaign name is required" });
      else if (name.length < 3) issues.push({ field: "name", message: "At least 3 characters" });

      if (draft.categoryId === "") issues.push({ field: "category", message: "Pick a category" });
      else if (!categories.byId.has(draft.categoryId))
        issues.push({ field: "category", message: "Unknown or archived category" });

      if (draft.templateId !== null) {
        const template = templates.byId.get(draft.templateId);
        if (!template) issues.push({ field: "template", message: "Unknown template" });
        else if (draft.categoryId !== "" && template.categoryId !== draft.categoryId)
          issues.push({ field: "template", message: "Template does not belong to that category" });
      }

      // Custom-field rules delegated to the fields domain — this is the
      // service→service edge that makes the editor rebuild when fields change.
      const custom = field.validateCustomValues(draft.customValues);
      return { ok: issues.length === 0 && custom.ok, issues: [...issues, ...custom.issues] };
    },
  };
}
