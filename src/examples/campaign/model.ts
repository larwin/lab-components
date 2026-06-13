/**
 * Internal domain models — the shapes the UI and business rules actually use.
 *
 * These are deliberately NOT the backend payloads (see dto.ts). Ids are nominal
 * so a CategoryId can never be passed where a TemplateId is expected; dates and
 * enums are real types, not loose strings. The mappers (mappers.ts) are the only
 * place a DTO turns into one of these and back.
 */

export type CategoryId = string & { readonly __brand: "CategoryId" };
export type TemplateId = string & { readonly __brand: "TemplateId" };
export type FieldId = string & { readonly __brand: "FieldId" };
export type CampaignId = string & { readonly __brand: "CampaignId" };

export type FieldType = "text" | "email" | "number";
export type CampaignStatus = "draft" | "scheduled" | "sent";

export interface Category {
  readonly id: CategoryId;
  readonly name: string;
  readonly archived: boolean;
}

export interface Template {
  readonly id: TemplateId;
  readonly name: string;
  readonly categoryId: CategoryId;
}

/** A custom field a campaign's contacts must fill — drives compiled validators. */
export interface Field {
  readonly id: FieldId;
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required: boolean;
  readonly maxLength: number | null;
}

export interface Campaign {
  readonly id: CampaignId;
  readonly name: string;
  readonly categoryId: CategoryId;
  readonly templateId: TemplateId | null;
  readonly status: CampaignStatus;
  readonly customValues: Readonly<Record<string, string>>;
}

/** The form's own model — closer to the UI than the domain entity. */
export interface CampaignFormModel {
  name: string;
  categoryId: CategoryId | "";
  templateId: TemplateId | null;
  customValues: Record<string, string>;
}

export const emptyCampaignForm = (): CampaignFormModel => ({
  name: "",
  categoryId: "",
  templateId: null,
  customValues: {},
});
