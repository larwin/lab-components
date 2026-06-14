import type { CampaignDraft } from "@/domains/campaigns";

/**
 * The editor's form model IS the campaigns domain's write input (`CampaignDraft`).
 * UI-local: it lives with the application, not in the container.
 */
export const emptyCampaignForm = (): CampaignDraft => ({
  name: "",
  categoryId: "",
  templateId: null,
  customValues: {},
});
