import { defineIntent } from "@/framework/core/runtime/intent";
import { createMachine } from "@/framework/core/runtime/machine";
import { createStore, type Store } from "@/framework/core/runtime/store";

import type { Category, CategoryId } from "./model";

/**
 * CategoryStore — a live, synchronous observable. Holds state + precomputed
 * indexes (in the snapshot, so `useStoreValue` selectors stay O(1) and stable).
 * It never fetches; data arrives via `set` dispatched by the facade.
 */
export interface CategoryState {
  readonly all: readonly Category[];
  readonly byId: ReadonlyMap<CategoryId, Category>;
  /** Precomputed so `s => s.active` is a stable reference between changes. */
  readonly active: readonly Category[];
}

export const categoryIntents = {
  set: defineIntent<{ items: readonly Category[] }>("category/set"),
};

const index = (items: readonly Category[]): CategoryState => ({
  all: items,
  byId: new Map(items.map((c) => [c.id, c])),
  active: items.filter((c) => !c.archived),
});

export const createCategoryStore = (): Store<CategoryState> =>
  createStore(
    createMachine<CategoryState>({
      id: "category-store",
      initialState: index([]),
      handlers: {
        [categoryIntents.set.type]: (_s, i) =>
          index((i.payload as { items: readonly Category[] }).items),
      },
    }),
  );
