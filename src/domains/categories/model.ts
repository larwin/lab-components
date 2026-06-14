/**
 * Categories domain — internal model. Nominal id, real types. The DTO (dto.ts)
 * is the wire shape; the mapper (mappers.ts) is the only bridge.
 */
export type CategoryId = string & { readonly __brand: "CategoryId" };

export interface Category {
  readonly id: CategoryId;
  readonly name: string;
  readonly archived: boolean;
}
