import type { CategoryId } from "@/domains/business/campaign/categories";

import type { TemplateDto } from "./dto";
import type { Template, TemplateId } from "./model";

export const toTemplate = (dto: TemplateDto): Template => ({
  id: dto.template_id as TemplateId,
  name: dto.label,
  categoryId: dto.category_id as CategoryId,
});
