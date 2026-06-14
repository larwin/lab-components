# src/domains

**Role:** the business layer — one folder per bounded context, each a pure,
Node-tested slice of domain logic (model · DTO · mapper · provider · store · service
· facade) wired into the DI container.
**Layer / generation:** next-gen business (RFC-003).
**Status:** active (the living reference that replaced the old `src/examples/campaign`).

## What lives here

Domains are nested under two roots — **business contexts** and shared
**technical** infra. Each business domain is a public barrel (`index.ts` exports
tokens + interfaces + a `register*Domain` function only):

- `business/campaign/` — the campaign bounded context:
  - `categories/` — per-tenant categories: `store` + `facade` (mounted at Account).
  - `templates/` — per-tenant templates: `store` + `facade`.
  - `campaigns/` — **pure functions only** (`campaign.writer.ts` + mappers); no store,
    no container registration — a writer + mapper is enough.
- `business/data-management/` — the data-management bounded context:
  - `fields/` — custom fields: `store` + **`service`** (validation, rebuilt on store
    change, `inject`s telemetry) + `facade`.
- `technical/` — shared infra domains exposed as value tokens (`http`, `telemetry`)
  that any business domain may inject; not a separate `platform/` layer.

The per-domain shape (where present): `model.ts` · `dto.ts` (zod wire schemas) ·
`mappers.ts` · `*.provider.ts` (fetch + parse + map; DTOs never escape) ·
`*.store.ts` (sync observable) · `*.service.ts` · `*.facade.ts` · `tokens.ts` ·
`register.ts` · `index.ts` · `__tests__/`.

## Conventions / rules

- **No React, no DOM** — pure TypeScript, tested in Node.
- A domain imports `framework` + other domains' **public barrels** only — never
  another domain's store/provider/internal files. Domains form a **DAG**;
  cross-domain orchestration belongs to `features`, not a hidden store edge.
- **Stores are sync and never fetch**; fetch lives in a provider driven by the
  facade/loader. DTOs never leave the provider.
- Default mount level is **Account** (per-tenant); only truly global reference data
  goes to App.

## Used by / depends on

- **Inbound:** `WebApplication`/`WebTest` (register the domains into the scope tree),
  `features/campaign-editor` (via barrels + tokens).
- **Outbound:** `framework/core`, `framework/services`, `domains/technical`
  (http/telemetry).

## See also

- [docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md](../../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) — §4 folder tree, §7 boundary rules, §9 naming.
- [../features/README.md](../features/README.md) — where cross-domain orchestration lives.
