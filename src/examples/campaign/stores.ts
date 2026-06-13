import { defineIntent } from "@/framework/core/runtime/intent";
import { createMachine } from "@/framework/core/runtime/machine";
import { createStore, type Store } from "@/framework/core/runtime/store";

import type { Category, CategoryId, Field, Template, TemplateId } from "./model";

/**
 * Live stores — thin machines over the core `Store`. They carry observable
 * state plus indexes (Map by id, precomputed derived slices), and NOTHING else:
 * no validation, no API calls, no campaign logic. The indexes live IN the
 * snapshot so selectors stay O(1) and referentially stable for useStoreValue.
 */

/* ---------- Category store ---------- */

export interface CategoryState {
  readonly all: readonly Category[];
  readonly byId: ReadonlyMap<CategoryId, Category>;
  /** Precomputed so `s => s.active` is a stable reference between changes. */
  readonly active: readonly Category[];
}

export const categoryIntents = {
  set: defineIntent<{ items: readonly Category[] }>("category/set"),
};

const indexCategories = (items: readonly Category[]): CategoryState => ({
  all: items,
  byId: new Map(items.map((c) => [c.id, c])),
  active: items.filter((c) => !c.archived),
});

export const createCategoryStore = (): Store<CategoryState> =>
  createStore(
    createMachine<CategoryState>({
      id: "category-store",
      initialState: indexCategories([]),
      handlers: {
        [categoryIntents.set.type]: (_s, i) =>
          indexCategories((i.payload as { items: readonly Category[] }).items),
      },
    }),
  );

/* ---------- Template store ---------- */

export interface TemplateState {
  readonly all: readonly Template[];
  readonly byId: ReadonlyMap<TemplateId, Template>;
}

export const templateIntents = {
  set: defineIntent<{ items: readonly Template[] }>("template/set"),
};

const indexTemplates = (items: readonly Template[]): TemplateState => ({
  all: items,
  byId: new Map(items.map((t) => [t.id, t])),
});

export const createTemplateStore = (): Store<TemplateState> =>
  createStore(
    createMachine<TemplateState>({
      id: "template-store",
      initialState: indexTemplates([]),
      handlers: {
        [templateIntents.set.type]: (_s, i) =>
          indexTemplates((i.payload as { items: readonly Template[] }).items),
      },
    }),
  );

/* ---------- Field store ---------- */

export interface FieldState {
  readonly all: readonly Field[];
  readonly byKey: ReadonlyMap<string, Field>;
}

export const fieldIntents = {
  set: defineIntent<{ items: readonly Field[] }>("field/set"),
};

const indexFields = (items: readonly Field[]): FieldState => ({
  all: items,
  byKey: new Map(items.map((f) => [f.key, f])),
});

export const createFieldStore = (): Store<FieldState> =>
  createStore(
    createMachine<FieldState>({
      id: "field-store",
      initialState: indexFields([]),
      handlers: {
        [fieldIntents.set.type]: (_s, i) =>
          indexFields((i.payload as { items: readonly Field[] }).items),
      },
    }),
  );
