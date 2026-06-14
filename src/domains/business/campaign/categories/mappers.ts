import type { CategoryDto } from "./dto";
import type { Category, CategoryId } from "./model";

/** The ONLY DTO ↔ model bridge for categories. `label` → `name` lives here. */
export const toCategory = (dto: CategoryDto): Category => ({
  id: dto.category_id as CategoryId,
  name: dto.label,
  archived: dto.is_archived,
});
