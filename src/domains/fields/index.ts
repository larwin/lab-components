import { defineFacade, defineService, defineStore, type Container } from "@/framework/services";

import { TelemetryToken } from "@/domains/technical/telemetry/telemetry";

import { createFieldFacade } from "./field.facade";
import { createFieldService } from "./field.service";
import { createFieldStore } from "./field.store";
import { FieldFacadeToken, FieldServiceToken, FieldStoreToken } from "./tokens";

export type { Field, FieldId, FieldType } from "./model";
export type { FieldState } from "./field.store";
export type { FieldFacade } from "./field.facade";
export type { FieldService, ValidationIssue, ValidationResult } from "./field.service";
export { FieldStoreToken, FieldServiceToken, FieldFacadeToken } from "./tokens";

export function registerFieldsDomain(account: Container): void {
  account.provide(defineStore(FieldStoreToken, { create: () => createFieldStore() }));
  account.provide(
    defineService(FieldServiceToken, {
      inject: { fields: FieldStoreToken, telemetry: TelemetryToken },
      create: ({ fields, telemetry }) => createFieldService(fields, telemetry),
    }),
  );
  account.provide(defineFacade(FieldFacadeToken, { create: (r) => createFieldFacade(r) }));
}
