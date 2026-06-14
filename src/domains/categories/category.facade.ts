import type { Resolver } from "@/framework/services";

import { ApiClientToken } from "@/platform/http/apiClient";

import { categoryProvider } from "./category.provider";
import { categoryIntents } from "./category.store";
import { CategoryStoreToken } from "./tokens";

/**
 * CategoryFacade — the stable door the UI uses to refresh categories. Holds the
 * resolver, builds its read provider once from the App-level ApiClient, and
 * dispatches fresh data into the store. Framework-free.
 */
export interface CategoryFacade {
  reload(): Promise<void>;
}

export function createCategoryFacade(resolve: Resolver): CategoryFacade {
  const store = () => resolve.get(CategoryStoreToken);
  const load = categoryProvider(resolve.get(ApiClientToken));
  return {
    async reload() {
      const items = await load();
      store().dispatch(categoryIntents.set({ items }));
    },
  };
}
