// @vitest-environment node
// Integration proof: the real domains + app service + facades wired through the
// two-level scope tree, with a zero-latency mock API. No React, no DOM.
import { beforeEach, describe, expect, it } from "vitest";

import { buildCampaignTree } from "@/app/campaignTree";
import { createMockApi } from "@/app/mockApi";
import { CategoryFacadeToken, type CategoryId } from "@/domains/categories";
import type { CampaignDraft } from "@/domains/campaigns";
import { FieldFacadeToken, type FieldFacade } from "@/domains/fields";
import { TemplateFacadeToken } from "@/domains/templates";
import {
  CampaignEditorFacadeToken,
  type CampaignEditorFacade,
} from "@/applications/campaign-editor";

describe("campaign-editor — invalidation across domains + app orchestration", () => {
  let account: ReturnType<typeof buildCampaignTree>["account"];
  let editor: CampaignEditorFacade;
  let field: FieldFacade;

  beforeEach(async () => {
    const tree = buildCampaignTree(createMockApi({ latency: 0 }));
    account = tree.account;
    editor = account.get(CampaignEditorFacadeToken);
    field = account.get(FieldFacadeToken);
    await account.get(CategoryFacadeToken).reload();
    await account.get(TemplateFacadeToken).reload();
    await field.reload();
  });

  it("builds each service once after the initial load", () => {
    expect(editor.serviceBuilds()).toEqual({ field: 1, editor: 1 });
  });

  it("adding a field rebuilds BOTH services once (editor injects field service)", async () => {
    expect(editor.serviceBuilds()).toEqual({ field: 1, editor: 1 });
    await field.addCustomField();
    expect(editor.serviceBuilds()).toEqual({ field: 2, editor: 2 });
  });

  it("reloading templates rebuilds ONLY the editor service (fields untouched)", async () => {
    expect(editor.serviceBuilds()).toEqual({ field: 1, editor: 1 });
    await account.get(TemplateFacadeToken).reload();
    expect(editor.serviceBuilds()).toEqual({ field: 1, editor: 2 });
  });

  it("reloading categories rebuilds ONLY the editor service", async () => {
    expect(editor.serviceBuilds()).toEqual({ field: 1, editor: 1 });
    await account.get(CategoryFacadeToken).reload();
    expect(editor.serviceBuilds()).toEqual({ field: 1, editor: 2 });
  });

  it("validates against the live field rules — a new required field makes the draft invalid", async () => {
    const baseDraft: CampaignDraft = {
      name: "Welcome series",
      categoryId: pickCategory(editor),
      templateId: null,
      customValues: { email: "ada@example.com" },
    };
    expect(editor.validate(baseDraft).ok).toBe(true);

    await field.addCustomField(); // appends a new REQUIRED field
    const result = editor.validate(baseDraft);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("save() maps the draft to a DTO and returns the persisted campaign", async () => {
    const draft: CampaignDraft = {
      name: "  Flash sale  ",
      categoryId: pickCategory(editor),
      templateId: null,
      customValues: { email: "ada@example.com" },
    };
    const { campaign, dto } = await editor.save(draft);
    expect(dto.label).toBe("Flash sale"); // trimmed at the boundary
    expect(campaign.id).toMatch(/^cmp_/);
    expect(campaign.status).toBe("draft");
  });

  it("rejects save() of an invalid draft", async () => {
    const bad: CampaignDraft = { name: "x", categoryId: "", templateId: null, customValues: {} };
    await expect(editor.save(bad)).rejects.toThrow(/Cannot save an invalid campaign/);
  });
});

/** Grab any seeded category id (templates map back to a valid category). */
function pickCategory(editor: CampaignEditorFacade): CategoryId {
  const templates = editor.templatesForCategory("cat_news" as CategoryId);
  if (templates.length > 0) return templates[0].categoryId;
  return "cat_tx" as CategoryId;
}
