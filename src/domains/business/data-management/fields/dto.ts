import { z } from "zod";

export const FieldDtoSchema = z.object({
  field_id: z.string(),
  field_key: z.string(),
  label: z.string(),
  data_type: z.enum(["text", "email", "number"]),
  is_required: z.boolean(),
  max_length: z.number().nullable(),
});

export type FieldDto = z.infer<typeof FieldDtoSchema>;
