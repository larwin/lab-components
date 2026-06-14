import { createContainer, defineValue, type Container } from "@/framework/services";

import {
  CategoryStoreToken,
  registerCategoriesDomain,
} from "@/domains/business/campaign/categories";
import { FieldStoreToken, registerFieldsDomain } from "@/domains/business/data-management/fields";
import { TemplateStoreToken, registerTemplatesDomain } from "@/domains/business/campaign/templates";
import { registerCampaignEditorApp } from "@/features/campaign-editor";
import { ApiClientToken, type ApiClient } from "@/domains/technical/http/apiClient";
import { createTelemetry, TelemetryToken } from "@/domains/technical/telemetry/telemetry";

import { createMockApi } from "./mockApi";

/**
 * The composition root — a two-level scope tree (RFC-003 §2):
 *
 *   App     (trunk)  → ApiClient (shared infrastructure)
 *     └─ Account (leaf) → Telemetry + all domains + the editor application
 *
 * Business data is per-tenant, so domains register on the Account node. The App
 * singleton (ApiClient) is resolved up-tree by Account-level providers and is
 * never duplicated. Disposing `app` tears the whole tree down.
 */
export interface CampaignTree {
  app: Container;
  account: Container;
}

export function buildCampaignTree(api: ApiClient = createMockApi()): CampaignTree {
  const app = createContainer();
  app.provide(defineValue(ApiClientToken, api));

  const account = app.createScope();
  account.provide(defineValue(TelemetryToken, createTelemetry()));
  registerCategoriesDomain(account);
  registerTemplatesDomain(account);
  registerFieldsDomain(account);
  registerCampaignEditorApp(account);

  // Validate the whole graph (Account sees App's providers merged) — missing
  // dep or construction cycle throws here, with the path.
  account.validate();

  // Materialize the stores so their invalidation subscriptions are active.
  account.get(CategoryStoreToken);
  account.get(TemplateStoreToken);
  account.get(FieldStoreToken);

  return { app, account };
}
