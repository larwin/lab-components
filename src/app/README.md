# src/app

**Role:** the composition root — the single place that builds the DI scope tree,
registers every domain and application, provides the concrete platform
implementations, and validates the whole graph at startup.
**Layer / generation:** next-gen composition root (RFC-003).
**Status:** active.

## What lives here

- `campaignTree.ts` — `buildCampaignTree(api?)`: builds the two-level scope tree
  (**App** node holds `ApiClientToken`; **Account** node holds telemetry + all domain
  registrations + the campaign-editor app), calls `validate()`, and materializes
  stores so subscriptions are live.
- `mockApi.ts` — a mock `ApiClient` (latency + data that varies between calls) used
  by the demo and tests.

> Note: RFC-003 §4 sketches `tree.ts` + `AppProviders.tsx` as the eventual generic
> shape. Today this folder is the concrete `campaignTree.ts` + `mockApi.ts` for the
> single shipped feature; the `<ServicesProvider>` wrapper currently lives in the
> `/services-demo` route. Generalising the names is a future step, not a divergence to fix now.

## Conventions / rules

- **Composition only** — wiring and graph validation, no component code, no business
  logic. The one place allowed to know every layer at once.
- Per-tenant isolation is structural: switching account re-addresses a different
  Account leaf, it does not tear down and rebuild.

## Used by / depends on

- **Inbound:** the `/services-demo` route (and tests) build the tree here.
- **Outbound:** `framework/services`, all `domains`, `applications/campaign-editor`,
  `platform`.

## See also

- [docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md](../../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) — §2 composite scope tree, §8 container upgrade.
