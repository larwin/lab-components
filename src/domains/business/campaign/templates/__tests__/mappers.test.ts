// @vitest-environment node
import { describe, expect, it } from "vitest";

import { TemplateDtoSchema } from "../dto";
import { toTemplate } from "../mappers";

describe("templates — mapper", () => {
  it("maps a template DTO", () => {
    const dto = TemplateDtoSchema.parse({
      template_id: "tpl_hero",
      label: "Hero",
      category_id: "cat_promo",
    });
    expect(toTemplate(dto)).toEqual({ id: "tpl_hero", name: "Hero", categoryId: "cat_promo" });
  });
});
