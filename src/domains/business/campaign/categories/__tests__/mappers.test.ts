// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CategoryDtoSchema } from "../dto";
import { toCategory } from "../mappers";

describe("categories — mapper", () => {
  it("maps a category DTO, renaming label → name", () => {
    const dto = CategoryDtoSchema.parse({
      category_id: "cat_news",
      label: "Newsletter",
      is_archived: true,
    });
    expect(toCategory(dto)).toEqual({ id: "cat_news", name: "Newsletter", archived: true });
  });
});
