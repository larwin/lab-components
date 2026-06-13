import type { CampaignDto, CategoryDto, FieldDto, TemplateDto } from "./dto";

/**
 * A mock backend. This stands in for the real HTTP client; it speaks DTOs
 * (snake_case wire shapes) and adds latency, so the app code exercises the same
 * async path it would in production. The data deliberately VARIES between calls
 * so the demo can show live stores updating and services being invalidated:
 *   - reloading categories rotates which ones are archived,
 *   - reloading templates bumps a version marker,
 *   - adding a field appends a new required custom field.
 *
 * This is app/demo code (not core), so setTimeout and a mutable seed are fine.
 */

export interface ApiClient {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

export interface MockApiOptions {
  /** Per-call latency in ms. Set 0 in tests. */
  latency?: number;
}

const CATEGORY_SEED: CategoryDto[] = [
  { category_id: "cat_news", label: "Newsletter", is_archived: false },
  { category_id: "cat_promo", label: "Promotions", is_archived: false },
  { category_id: "cat_tx", label: "Transactional", is_archived: false },
  { category_id: "cat_event", label: "Events", is_archived: false },
  { category_id: "cat_survey", label: "Surveys", is_archived: false },
  { category_id: "cat_winback", label: "Win-back", is_archived: false },
];

const TEMPLATE_SEED: Omit<TemplateDto, "label">[] = [
  { template_id: "tpl_minimal", category_id: "cat_news" },
  { template_id: "tpl_hero", category_id: "cat_promo" },
  { template_id: "tpl_receipt", category_id: "cat_tx" },
  { template_id: "tpl_invite", category_id: "cat_event" },
  { template_id: "tpl_nps", category_id: "cat_survey" },
];

const INITIAL_FIELDS: FieldDto[] = [
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

const EXTRA_FIELD_POOL: Omit<FieldDto, "field_id">[] = [
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
  // Mutable seed — each call may read or evolve it. This is what "varies".
  let categoryReload = 0;
  let templateReload = 0;
  let fields: FieldDto[] = INITIAL_FIELDS.map((f) => ({ ...f }));
  let campaignSeq = 0;

  const delay = () =>
    latency > 0 ? new Promise((r) => setTimeout(r, latency)) : Promise.resolve();

  return {
    async get(path) {
      await delay();
      if (path === "/categories") {
        categoryReload += 1;
        // Rotate which two categories are archived, so the active set shifts.
        const a = categoryReload % CATEGORY_SEED.length;
        const b = (categoryReload + 2) % CATEGORY_SEED.length;
        return CATEGORY_SEED.map((c, i) => ({ ...c, is_archived: i === a || i === b }));
      }
      if (path === "/templates") {
        templateReload += 1;
        const suffix = templateReload > 1 ? ` (v${templateReload})` : "";
        return TEMPLATE_SEED.map((t) => ({
          ...t,
          label: prettyTemplate(t.template_id) + suffix,
        }));
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
        const created: FieldDto = { ...next, field_id: `fld_${fields.length}_${next.field_key}` };
        fields = [...fields, created];
        return created;
      }
      if (path === "/campaigns") {
        campaignSeq += 1;
        const upsert = body as Omit<CampaignDto, "campaign_id" | "status">;
        const saved: CampaignDto = {
          campaign_id: `cmp_${campaignSeq}`,
          status: "draft",
          ...upsert,
        };
        return saved;
      }
      throw new Error(`Mock POST 404: ${path}`);
    },
  };
}

function prettyTemplate(id: string): string {
  return id.replace(/^tpl_/, "").replace(/^\w/, (c) => c.toUpperCase());
}
