import { facadeToken, storeToken } from "@/framework/services";

import type { TemplateFacade } from "./template.facade";
import type { TemplateState } from "./template.store";

export const TemplateStoreToken = storeToken<TemplateState>("TemplateStore");
export const TemplateFacadeToken = facadeToken<TemplateFacade>("TemplateFacade");
