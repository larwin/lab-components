import type { CategoryId } from "@/domains/business/campaign/categories";
import type { TemplateId } from "@/domains/business/campaign/templates";

import type { CampaignDto, CampaignUpsertDto } from "./dto";
import type { Campaign, CampaignDraft, CampaignId } from "./model";

export const toCampaign = (dto: CampaignDto): Campaign => ({
  id: dto.campaign_id as CampaignId,
  name: dto.label,
  categoryId: dto.category_id as CategoryId,
  templateId: (dto.template_id as TemplateId | null) ?? null,
  status: dto.status,
  customValues: dto.custom_values,
});

/** Draft → upsert DTO. The form never builds a DTO by hand. */
export const toCampaignUpsertDto = (draft: CampaignDraft): CampaignUpsertDto => ({
  label: draft.name.trim(),
  category_id: draft.categoryId,
  template_id: draft.templateId,
  custom_values: draft.customValues,
});
