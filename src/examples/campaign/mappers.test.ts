// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CampaignDtoSchema, CategoryDtoSchema, FieldDtoSchema, TemplateDtoSchema } from "./dto";
import { toCampaign, toCampaignUpsertDto, toCategory, toField, toTemplate } from "./mappers";
import type { CampaignFormModel, CategoryId, TemplateId } from "./model";

describe("mappers — DTO ↔ domain model", () => {
  it("maps a category DTO, renaming label → name", () => {
    const dto = CategoryDtoSchema.parse({
      category_id: "cat_news",
      label: "Newsletter",
      is_archived: true,
    });
    expect(toCategory(dto)).toEqual({ id: "cat_news", name: "Newsletter", archived: true });
  });

  it("maps a template DTO", () => {
    const dto = TemplateDtoSchema.parse({
      template_id: "tpl_hero",
      label: "Hero",
      category_id: "cat_promo",
    });
    expect(toTemplate(dto)).toEqual({ id: "tpl_hero", name: "Hero", categoryId: "cat_promo" });
  });

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

  it("round-trips a campaign form model → upsert DTO → campaign model", () => {
    const form: CampaignFormModel = {
      name: "  Spring sale  ",
      categoryId: "cat_promo" as CategoryId,
      templateId: "tpl_hero" as TemplateId,
      customValues: { email: "ada@example.com" },
    };
    const dto = toCampaignUpsertDto(form);
    expect(dto).toEqual({
      label: "Spring sale", // trimmed at the boundary
      category_id: "cat_promo",
      template_id: "tpl_hero",
      custom_values: { email: "ada@example.com" },
    });

    const saved = toCampaign(
      CampaignDtoSchema.parse({ ...dto, campaign_id: "cmp_1", status: "draft" }),
    );
    expect(saved).toEqual({
      id: "cmp_1",
      name: "Spring sale",
      categoryId: "cat_promo",
      templateId: "tpl_hero",
      status: "draft",
      customValues: { email: "ada@example.com" },
    });
  });
});
