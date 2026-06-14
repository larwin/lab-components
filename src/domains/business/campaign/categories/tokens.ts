import { facadeToken, storeToken } from "@/framework/services";

import type { CategoryFacade } from "./category.facade";
import type { CategoryState } from "./category.store";

export const CategoryStoreToken = storeToken<CategoryState>("CategoryStore");
export const CategoryFacadeToken = facadeToken<CategoryFacade>("CategoryFacade");
