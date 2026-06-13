import type { CampaignDto, CampaignUpsertDto, CategoryDto, FieldDto, TemplateDto } from "./dto";
import type {
  Campaign,
  CampaignFormModel,
  Category,
  CategoryId,
  Field,
  FieldId,
  Template,
  TemplateId,
} from "./model";

/**
 * Mappers — the ONLY translation between wire DTOs and domain models. Pure
 * functions, unit-tested both directions (mappers.test.ts). Renaming a backend
 * field (`label` → `name`, `category_id` → `categoryId`) happens here and only
 * here, so the rest of the app is insulated from the wire format.
 */

export const toCategory = (dto: CategoryDto): Category => ({
  id: dto.category_id as CategoryId,
  name: dto.label,
  archived: dto.is_archived,
});

export const toTemplate = (dto: TemplateDto): Template => ({
  id: dto.template_id as TemplateId,
  name: dto.label,
  categoryId: dto.category_id as CategoryId,
});

export const toField = (dto: FieldDto): Field => ({
  id: dto.field_id as FieldId,
  key: dto.field_key,
  label: dto.label,
  type: dto.data_type,
  required: dto.is_required,
  maxLength: dto.max_length,
});

export const toCampaign = (dto: CampaignDto): Campaign => ({
  id: dto.campaign_id as Campaign["id"],
  name: dto.label,
  categoryId: dto.category_id as CategoryId,
  templateId: (dto.template_id as TemplateId | null) ?? null,
  status: dto.status,
  customValues: dto.custom_values,
});

/** Form model → upsert DTO. The form never builds a DTO by hand. */
export const toCampaignUpsertDto = (model: CampaignFormModel): CampaignUpsertDto => ({
  label: model.name.trim(),
  category_id: model.categoryId,
  template_id: model.templateId,
  custom_values: model.customValues,
});
