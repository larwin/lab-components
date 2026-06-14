import { z } from "zod";

/** Backend wire contract for categories. snake_case; validated, never leaked. */
export const CategoryDtoSchema = z.object({
  category_id: z.string(),
  label: z.string(),
  is_archived: z.boolean(),
});

export type CategoryDto = z.infer<typeof CategoryDtoSchema>;
