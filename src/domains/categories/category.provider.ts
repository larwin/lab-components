import { z } from "zod";

import type { ApiClient } from "@/domains/technical/http/apiClient";

import { CategoryDtoSchema } from "./dto";
import { toCategory } from "./mappers";
import type { Category } from "./model";

/**
 * Read provider — replaces the gen-1 repository class. Fetch + zod-parse + map,
 * all in one function. The DTO never escapes here. Driven by the facade, which
 * dispatches the result into the (synchronous) store.
 */
export const categoryProvider = (api: ApiClient) => async (): Promise<readonly Category[]> => {
  const raw = await api.get("/categories");
  return z.array(CategoryDtoSchema).parse(raw).map(toCategory);
};
