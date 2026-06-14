import type { Resolver } from "@/framework/services";

import { ApiClientToken } from "@/platform/http/apiClient";

import { createFieldCommand, fieldProvider } from "./field.provider";
import { fieldIntents } from "./field.store";
import type { Field } from "./model";
import { FieldServiceToken, FieldStoreToken } from "./tokens";

export interface FieldFacade {
  reload(): Promise<void>;
  /** Append a new required custom field (mocked) — invalidates dependent services. */
  addCustomField(): Promise<Field>;
  requiredFieldKeys(): readonly string[];
}

export function createFieldFacade(resolve: Resolver): FieldFacade {
  const store = () => resolve.get(FieldStoreToken);
  const service = () => resolve.get(FieldServiceToken);
  const api = resolve.get(ApiClientToken);
  const list = fieldProvider(api);
  const create = createFieldCommand(api);

  return {
    async reload() {
      store().dispatch(fieldIntents.set({ items: await list() }));
    },
    async addCustomField() {
      const created = await create();
      store().dispatch(fieldIntents.set({ items: await list() }));
      return created;
    },
    requiredFieldKeys: () => service().requiredFieldKeys(),
  };
}
