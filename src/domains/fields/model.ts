/** Fields domain — custom fields a campaign's contacts must fill. */
export type FieldId = string & { readonly __brand: "FieldId" };
export type FieldType = "text" | "email" | "number";

export interface Field {
  readonly id: FieldId;
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required: boolean;
  readonly maxLength: number | null;
}
