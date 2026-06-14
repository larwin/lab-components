import { z } from "zod";

import type { ApiClient } from "@/platform/http/apiClient";

import { FieldDtoSchema } from "./dto";
import { toField } from "./mappers";
import type { Field } from "./model";

/** Read provider — list the custom fields. */
export const fieldProvider = (api: ApiClient) => async (): Promise<readonly Field[]> => {
  const raw = await api.get("/fields");
  return z.array(FieldDtoSchema).parse(raw).map(toField);
};

/** Write command — append a new field (mocked) and return it. */
export const createFieldCommand = (api: ApiClient) => async (): Promise<Field> => {
  const raw = await api.post("/fields", {});
  return toField(FieldDtoSchema.parse(raw));
};
