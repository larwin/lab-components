// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { CategoryId } from "@/domains/business/campaign/categories";
import type { TemplateId } from "@/domains/business/campaign/templates";

import { CampaignDtoSchema } from "../dto";
import { toCampaign, toCampaignUpsertDto } from "../mappers";
import type { CampaignDraft } from "../model";

describe("campaigns — mappers (round-trip)", () => {
  it("round-trips a draft → upsert DTO → campaign model", () => {
    const draft: CampaignDraft = {
      name: "  Spring sale  ",
      categoryId: "cat_promo" as CategoryId,
      templateId: "tpl_hero" as TemplateId,
      customValues: { email: "ada@example.com" },
    };
    const dto = toCampaignUpsertDto(draft);
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
