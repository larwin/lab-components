import type { Resolver } from "@/framework/services";

import { ApiClientToken } from "@/domains/technical/http/apiClient";

import { templateProvider } from "./template.provider";
import { templateIntents } from "./template.store";
import { TemplateStoreToken } from "./tokens";

export interface TemplateFacade {
  reload(): Promise<void>;
}

export function createTemplateFacade(resolve: Resolver): TemplateFacade {
  const store = () => resolve.get(TemplateStoreToken);
  const load = templateProvider(resolve.get(ApiClientToken));
  return {
    async reload() {
      const items = await load();
      store().dispatch(templateIntents.set({ items }));
    },
  };
}
