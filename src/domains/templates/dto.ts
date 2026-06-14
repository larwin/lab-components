import { z } from "zod";

export const TemplateDtoSchema = z.object({
  template_id: z.string(),
  label: z.string(),
  category_id: z.string(),
});

export type TemplateDto = z.infer<typeof TemplateDtoSchema>;
