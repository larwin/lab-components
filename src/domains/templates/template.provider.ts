import { z } from "zod";

import type { ApiClient } from "@/platform/http/apiClient";

import { TemplateDtoSchema } from "./dto";
import { toTemplate } from "./mappers";
import type { Template } from "./model";

export const templateProvider = (api: ApiClient) => async (): Promise<readonly Template[]> => {
  const raw = await api.get("/templates");
  return z.array(TemplateDtoSchema).parse(raw).map(toTemplate);
};
