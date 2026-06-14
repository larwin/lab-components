import type { FieldDto } from "./dto";
import type { Field, FieldId } from "./model";

export const toField = (dto: FieldDto): Field => ({
  id: dto.field_id as FieldId,
  key: dto.field_key,
  label: dto.label,
  type: dto.data_type,
  required: dto.is_required,
  maxLength: dto.max_length,
});
