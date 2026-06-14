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

/**
 * The web application host — the composition root that builds the prod scope
 * tree (RFC-003 §2 / RFC-004):
 *
 *   App     (trunk)  → ApiClient (shared infrastructure)
 *     └─ Account (leaf) → Telemetry + all domains + the editor feature
 *
 * Business data is per-tenant, so domains register on the Account node. The App
 * singleton (ApiClient) is resolved up-tree by Account-level providers and is
 * never duplicated. Disposing `app` tears the whole tree down.
 *
 * This lab/doc app has no real backend: the running demo is wired on the mock
 * backend below, so `createMockApi()` is the default api. The test host
 * (`WebTest.ts`) builds the SAME tree with a zero-latency mock + fakes — a single
 * DI entry point per environment, prod never importing the test host.
 */
export interface WebApplicationTree {
  app: Container;
  account: Container;
}

export function buildWebApplication(api: ApiClient = createMockApi()): WebApplicationTree {
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

/* -------------------------------------------------------------------------- */
/* Mock backend (dev/demo + tests)                                            */
/* -------------------------------------------------------------------------- */

/**
 * A mock backend (dev/demo). Speaks DTOs (snake_case wire shapes) with latency,
 * and deliberately VARIES data between calls so the demo can show live stores
 * updating and services being invalidated. The seed shapes are the mock's own
 * concern — it returns `unknown`; the domain providers zod-parse at the boundary.
 */
interface CategoryRow {
  category_id: string;
  label: string;
  is_archived: boolean;
}
interface TemplateRow {
  template_id: string;
  label: string;
  category_id: string;
}
interface FieldRow {
  field_id: string;
  field_key: string;
  label: string;
  data_type: "text" | "email" | "number";
  is_required: boolean;
  max_length: number | null;
}

export interface MockApiOptions {
  /** Per-call latency in ms. Set 0 in tests. */
  latency?: number;
}

const CATEGORY_SEED: CategoryRow[] = [
  { category_id: "cat_news", label: "Newsletter", is_archived: false },
  { category_id: "cat_promo", label: "Promotions", is_archived: false },
  { category_id: "cat_tx", label: "Transactional", is_archived: false },
  { category_id: "cat_event", label: "Events", is_archived: false },
  { category_id: "cat_survey", label: "Surveys", is_archived: false },
  { category_id: "cat_winback", label: "Win-back", is_archived: false },
];

const TEMPLATE_SEED: Omit<TemplateRow, "label">[] = [
  { template_id: "tpl_minimal", category_id: "cat_news" },
  { template_id: "tpl_hero", category_id: "cat_promo" },
  { template_id: "tpl_receipt", category_id: "cat_tx" },
  { template_id: "tpl_invite", category_id: "cat_event" },
  { template_id: "tpl_nps", category_id: "cat_survey" },
];

const INITIAL_FIELDS: FieldRow[] = [
  {
    field_id: "fld_email",
    field_key: "email",
    label: "Email",
    data_type: "email",
    is_required: true,
    max_length: null,
  },
  {
    field_id: "fld_firstname",
    field_key: "firstName",
    label: "First name",
    data_type: "text",
    is_required: false,
    max_length: 40,
  },
];

const EXTRA_FIELD_POOL: Omit<FieldRow, "field_id">[] = [
  { field_key: "company", label: "Company", data_type: "text", is_required: true, max_length: 60 },
  { field_key: "age", label: "Age", data_type: "number", is_required: true, max_length: null },
  { field_key: "city", label: "City", data_type: "text", is_required: true, max_length: 50 },
  {
    field_key: "backupEmail",
    label: "Backup email",
    data_type: "email",
    is_required: true,
    max_length: null,
  },
];

export function createMockApi({ latency = 350 }: MockApiOptions = {}): ApiClient {
  let categoryReload = 0;
  let templateReload = 0;
  let fields: FieldRow[] = INITIAL_FIELDS.map((f) => ({ ...f }));
  let campaignSeq = 0;

  const delay = () =>
    latency > 0 ? new Promise((r) => setTimeout(r, latency)) : Promise.resolve();

  return {
    async get(path) {
      await delay();
      if (path === "/categories") {
        categoryReload += 1;
        const a = categoryReload % CATEGORY_SEED.length;
        const b = (categoryReload + 2) % CATEGORY_SEED.length;
        return CATEGORY_SEED.map((c, i) => ({ ...c, is_archived: i === a || i === b }));
      }
      if (path === "/templates") {
        templateReload += 1;
        const suffix = templateReload > 1 ? ` (v${templateReload})` : "";
        return TEMPLATE_SEED.map((t) => ({ ...t, label: prettyTemplate(t.template_id) + suffix }));
      }
      if (path === "/fields") {
        return fields.map((f) => ({ ...f }));
      }
      throw new Error(`Mock GET 404: ${path}`);
    },

    async post(path, body) {
      await delay();
      if (path === "/fields") {
        const next = EXTRA_FIELD_POOL[fields.length % EXTRA_FIELD_POOL.length];
        const created: FieldRow = { ...next, field_id: `fld_${fields.length}_${next.field_key}` };
        fields = [...fields, created];
        return created;
      }
      if (path === "/campaigns") {
        campaignSeq += 1;
        const upsert = body as Record<string, unknown>;
        return { campaign_id: `cmp_${campaignSeq}`, status: "draft", ...upsert };
      }
      throw new Error(`Mock POST 404: ${path}`);
    },
  };
}

function prettyTemplate(id: string): string {
  return id.replace(/^tpl_/, "").replace(/^\w/, (c) => c.toUpperCase());
}
