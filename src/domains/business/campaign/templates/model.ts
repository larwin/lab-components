import type { CategoryId } from "@/domains/business/campaign/categories";

/** Templates domain — a template belongs to a category (cross-domain id). */
export type TemplateId = string & { readonly __brand: "TemplateId" };

export interface Template {
  readonly id: TemplateId;
  readonly name: string;
  readonly categoryId: CategoryId;
}
