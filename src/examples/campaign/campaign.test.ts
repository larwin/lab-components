// @vitest-environment node
// Integration proof: the real stores + services + facades wired through the
// container, with a zero-latency mock API. No React, no DOM.
import { beforeEach, describe, expect, it } from "vitest";

import { createMockApi } from "./api";
import { buildCampaignContainer } from "./container";
import type { CampaignFacade, ContactFacade } from "./facades";
import type { CampaignFormModel, CategoryId, TemplateId } from "./model";
import { CampaignFacadeToken, ContactFacadeToken } from "./tokens";
import type { Container } from "@/framework/services";

describe("campaign example — invalidation through real services", () => {
  let container: Container;
  let campaign: CampaignFacade;
  let contact: ContactFacade;

  beforeEach(async () => {
    container = buildCampaignContainer(createMockApi({ latency: 0 }));
    campaign = container.get(CampaignFacadeToken);
    contact = container.get(ContactFacadeToken);
    await campaign.reloadCategories();
    await campaign.reloadTemplates();
    await contact.reloadFields();
  });

  it("builds each service once after the initial load", () => {
    const builds = campaign.serviceBuilds();
    expect(builds).toEqual({ contact: 1, campaign: 1 });
  });

  it("adding a field rebuilds BOTH services once (transitive: campaign injects contact)", async () => {
    expect(campaign.serviceBuilds()).toEqual({ contact: 1, campaign: 1 });
    await contact.addCustomField();
    expect(campaign.serviceBuilds()).toEqual({ contact: 2, campaign: 2 });
  });

  it("reloading templates rebuilds ONLY the campaign service (fields untouched)", async () => {
    expect(campaign.serviceBuilds()).toEqual({ contact: 1, campaign: 1 });
    await campaign.reloadTemplates();
    expect(campaign.serviceBuilds()).toEqual({ contact: 1, campaign: 2 });
  });

  it("reloading categories rebuilds ONLY the campaign service", async () => {
    expect(campaign.serviceBuilds()).toEqual({ contact: 1, campaign: 1 });
    await campaign.reloadCategories();
    expect(campaign.serviceBuilds()).toEqual({ contact: 1, campaign: 2 });
  });

  it("validates against the live field rules — a newly added required field makes the form invalid", async () => {
    const baseModel: CampaignFormModel = {
      name: "Welcome series",
      categoryId: pickActiveCategory(campaign),
      templateId: null,
      customValues: { email: "ada@example.com" },
    };
    expect(campaign.validate(baseModel).ok).toBe(true);

    await contact.addCustomField(); // appends a new REQUIRED field (e.g. company)
    const result = campaign.validate(baseModel);
    expect(result.ok).toBe(false); // the new required field is now missing
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("save() maps the form model to a DTO and returns the persisted campaign", async () => {
    const model: CampaignFormModel = {
      name: "  Flash sale  ",
      categoryId: pickActiveCategory(campaign),
      templateId: null,
      customValues: { email: "ada@example.com" },
    };
    const { campaign: saved, dto } = await campaign.save(model);
    expect(dto.label).toBe("Flash sale"); // trimmed at the boundary
    expect(saved.id).toMatch(/^cmp_/);
    expect(saved.status).toBe("draft");
  });

  it("rejects save() of an invalid model", async () => {
    const bad: CampaignFormModel = {
      name: "x",
      categoryId: "",
      templateId: null,
      customValues: {},
    };
    await expect(campaign.save(bad)).rejects.toThrow(/Cannot save an invalid campaign/);
  });
});

/** Helper: grab any currently-active category id from the campaign facade. */
function pickActiveCategory(campaign: CampaignFacade): CategoryId {
  // The campaign service exposes templates per category; we just need a valid id.
  // Active categories drive the Select; here we read the first template's category
  // which is guaranteed to map to a seeded (and currently valid) category.
  const templates = campaign.templatesForCategory("cat_news" as CategoryId);
  if (templates.length > 0) return templates[0].categoryId;
  return "cat_tx" as CategoryId;
}
