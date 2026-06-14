import { defineFacade, defineStore, type Container } from "@/framework/services";

import { createCategoryFacade } from "./category.facade";
import { createCategoryStore } from "./category.store";
import { CategoryFacadeToken, CategoryStoreToken } from "./tokens";

/**
 * Public barrel for the categories domain: tokens + contracts + the register
 * function. Other domains and applications import ONLY from here — never an
 * internal file. The category data is per-tenant, so the domain registers at
 * the Account node.
 */
export type { Category, CategoryId } from "./model";
export type { CategoryState } from "./category.store";
export type { CategoryFacade } from "./category.facade";
export { CategoryStoreToken, CategoryFacadeToken } from "./tokens";

export function registerCategoriesDomain(account: Container): void {
  account.provide(defineStore(CategoryStoreToken, { create: () => createCategoryStore() }));
  account.provide(defineFacade(CategoryFacadeToken, { create: (r) => createCategoryFacade(r) }));
}
