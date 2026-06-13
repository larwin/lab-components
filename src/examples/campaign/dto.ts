import { z } from "zod";

/**
 * Backend DTOs — the wire contract. snake_case, ids as bare strings, nullables
 * the way the API sends them. Validated at the repository boundary with zod and
 * NEVER allowed to leak past it: repositories parse a DTO and immediately map it
 * to a domain model (see mappers.ts).
 */

export const CategoryDtoSchema = z.object({
  category_id: z.string(),
  label: z.string(),
  is_archived: z.boolean(),
});

export const TemplateDtoSchema = z.object({
  template_id: z.string(),
  label: z.string(),
  category_id: z.string(),
});

export const FieldDtoSchema = z.object({
  field_id: z.string(),
  field_key: z.string(),
  label: z.string(),
  data_type: z.enum(["text", "email", "number"]),
  is_required: z.boolean(),
  max_length: z.number().nullable(),
});

export const CampaignDtoSchema = z.object({
  campaign_id: z.string(),
  label: z.string(),
  category_id: z.string(),
  template_id: z.string().nullable(),
  status: z.enum(["draft", "scheduled", "sent"]),
  custom_values: z.record(z.string()),
});

export const CampaignUpsertDtoSchema = z.object({
  label: z.string(),
  category_id: z.string(),
  template_id: z.string().nullable(),
  custom_values: z.record(z.string()),
});

export type CategoryDto = z.infer<typeof CategoryDtoSchema>;
export type TemplateDto = z.infer<typeof TemplateDtoSchema>;
export type FieldDto = z.infer<typeof FieldDtoSchema>;
export type CampaignDto = z.infer<typeof CampaignDtoSchema>;
export type CampaignUpsertDto = z.infer<typeof CampaignUpsertDtoSchema>;
