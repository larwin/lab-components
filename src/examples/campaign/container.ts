import {
  createContainer,
  defineFacade,
  defineService,
  defineStore,
  defineValue,
  type Container,
} from "@/framework/services";

import { createMockApi, type ApiClient } from "./api";
import { createCampaignFacade, createContactFacade } from "./facades";
import {
  createCampaignRepository,
  createCategoryRepository,
  createFieldRepository,
  createTemplateRepository,
} from "./repositories";
import { createCampaignService, createContactService, createTelemetry } from "./services";
import { createCategoryStore, createFieldStore, createTemplateStore } from "./stores";
import {
  ApiClientToken,
  CampaignFacadeToken,
  CampaignRepositoryToken,
  CampaignServiceToken,
  CategoryRepositoryToken,
  CategoryStoreToken,
  ContactFacadeToken,
  ContactServiceToken,
  FieldRepositoryToken,
  FieldStoreToken,
  TelemetryToken,
  TemplateRepositoryToken,
  TemplateStoreToken,
} from "./tokens";

/**
 * The composition root. This is the ONE file where the whole dependency graph
 * is visible as plain data. Read top to bottom: values, repositories, stores,
 * services (with their `inject` declarations), facades. The `inject` map of each
 * service IS its dependency declaration — there is nowhere else to look, and the
 * factory can only use what it lists. `validate()` then proves the graph has no
 * missing edge and no cycle before anything runs.
 */
export function buildCampaignContainer(api: ApiClient = createMockApi()): Container {
  const c = createContainer();

  // values & infrastructure
  c.provide(defineValue(ApiClientToken, api));
  c.provide(defineValue(TelemetryToken, createTelemetry()));

  // repositories — singletons built from the ApiClient value
  c.provide(defineValue(CategoryRepositoryToken, createCategoryRepository(api)));
  c.provide(defineValue(TemplateRepositoryToken, createTemplateRepository(api)));
  c.provide(defineValue(FieldRepositoryToken, createFieldRepository(api)));
  c.provide(defineValue(CampaignRepositoryToken, createCampaignRepository(api)));

  // live stores — reactive roots
  c.provide(defineStore(CategoryStoreToken, { create: () => createCategoryStore() }));
  c.provide(defineStore(TemplateStoreToken, { create: () => createTemplateStore() }));
  c.provide(defineStore(FieldStoreToken, { create: () => createFieldStore() }));

  // scoped services — the `inject` map is the dependency graph
  c.provide(
    defineService(ContactServiceToken, {
      inject: { fields: FieldStoreToken, telemetry: TelemetryToken },
      create: ({ fields, telemetry }) => createContactService(fields, telemetry),
    }),
  );
  c.provide(
    defineService(CampaignServiceToken, {
      inject: {
        categories: CategoryStoreToken,
        templates: TemplateStoreToken,
        contact: ContactServiceToken,
        telemetry: TelemetryToken,
      },
      create: ({ categories, templates, contact, telemetry }) =>
        createCampaignService(categories, templates, contact, telemetry),
    }),
  );

  // stable facades — the UI's only entry points
  c.provide(
    defineFacade(ContactFacadeToken, { create: (resolve) => createContactFacade(resolve) }),
  );
  c.provide(
    defineFacade(CampaignFacadeToken, { create: (resolve) => createCampaignFacade(resolve) }),
  );

  // Fail fast: missing dependency or cycle throws here, at startup, with a path.
  c.validate();

  // Materialize the stores so their invalidation subscriptions are active.
  c.get(CategoryStoreToken);
  c.get(TemplateStoreToken);
  c.get(FieldStoreToken);

  return c;
}
