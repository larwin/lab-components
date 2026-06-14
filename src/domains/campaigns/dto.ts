import { z } from "zod";

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

export type CampaignDto = z.infer<typeof CampaignDtoSchema>;
export type CampaignUpsertDto = z.infer<typeof CampaignUpsertDtoSchema>;
