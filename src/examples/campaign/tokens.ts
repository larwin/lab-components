import { facadeToken, serviceToken, storeToken, valueToken } from "@/framework/services";

import type { ApiClient } from "./api";
import type {
  CampaignRepository,
  CategoryRepository,
  FieldRepository,
  TemplateRepository,
} from "./repositories";
import type { CampaignService, ContactService, Telemetry } from "./services";
import type { CategoryState, FieldState, TemplateState } from "./stores";
import type { CampaignFacade, ContactFacade } from "./facades";

/**
 * Every dependency the container can resolve, declared once with a role-branded
 * token. The role steers the wiring: a `storeToken` can only be `defineStore`d,
 * a `facadeToken` is the only thing `useFacade` accepts, and so on.
 */

// values & infrastructure
export const ApiClientToken = valueToken<ApiClient>("ApiClient");
export const TelemetryToken = valueToken<Telemetry>("Telemetry");

// repositories (singletons)
export const CategoryRepositoryToken = valueToken<CategoryRepository>("CategoryRepository");
export const TemplateRepositoryToken = valueToken<TemplateRepository>("TemplateRepository");
export const FieldRepositoryToken = valueToken<FieldRepository>("FieldRepository");
export const CampaignRepositoryToken = valueToken<CampaignRepository>("CampaignRepository");

// live stores (reactive roots)
export const CategoryStoreToken = storeToken<CategoryState>("CategoryStore");
export const TemplateStoreToken = storeToken<TemplateState>("TemplateStore");
export const FieldStoreToken = storeToken<FieldState>("FieldStore");

// scoped services (invalidated when their declared deps change)
export const ContactServiceToken = serviceToken<ContactService>("ContactService");
export const CampaignServiceToken = serviceToken<CampaignService>("CampaignService");

// stable facades (the only doors a component uses)
export const ContactFacadeToken = facadeToken<ContactFacade>("ContactFacade");
export const CampaignFacadeToken = facadeToken<CampaignFacade>("CampaignFacade");
