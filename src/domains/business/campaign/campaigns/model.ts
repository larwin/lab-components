import type { CategoryId } from "@/domains/business/campaign/categories";
import type { TemplateId } from "@/domains/business/campaign/templates";

/** Campaigns domain — the Campaign entity and its write-input (draft). */
export type CampaignId = string & { readonly __brand: "CampaignId" };
export type CampaignStatus = "draft" | "scheduled" | "sent";

export interface Campaign {
  readonly id: CampaignId;
  readonly name: string;
  readonly categoryId: CategoryId;
  readonly templateId: TemplateId | null;
  readonly status: CampaignStatus;
  readonly customValues: Readonly<Record<string, string>>;
}

/**
 * The domain's WRITE input — what the editor produces and the writer persists.
 * Owned by the domain (the app's form model is this shape), so the mapper can
 * live here without the domain ever importing the application layer.
 */
export interface CampaignDraft {
  name: string;
  categoryId: CategoryId | "";
  templateId: TemplateId | null;
  customValues: Record<string, string>;
}
