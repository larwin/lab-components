// @vitest-environment node
import { describe, expect, it } from "vitest";

import { FieldDtoSchema } from "../dto";
import { toField } from "../mappers";

describe("fields — mapper", () => {
  it("maps a field DTO, preserving the nullable max_length", () => {
    const dto = FieldDtoSchema.parse({
      field_id: "fld_email",
      field_key: "email",
      label: "Email",
      data_type: "email",
      is_required: true,
      max_length: null,
    });
    expect(toField(dto)).toMatchObject({
      key: "email",
      type: "email",
      required: true,
      maxLength: null,
    });
  });
});
