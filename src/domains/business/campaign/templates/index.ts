import { defineFacade, defineStore, type Container } from "@/framework/services";

import { createTemplateFacade } from "./template.facade";
import { createTemplateStore } from "./template.store";
import { TemplateFacadeToken, TemplateStoreToken } from "./tokens";

export type { Template, TemplateId } from "./model";
export type { TemplateState } from "./template.store";
export type { TemplateFacade } from "./template.facade";
export { TemplateStoreToken, TemplateFacadeToken } from "./tokens";

export function registerTemplatesDomain(account: Container): void {
  account.provide(defineStore(TemplateStoreToken, { create: () => createTemplateStore() }));
  account.provide(defineFacade(TemplateFacadeToken, { create: (r) => createTemplateFacade(r) }));
}
