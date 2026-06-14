# RFC-004 — `src/` layout: hosts, business/technical domains, features, shared

Status: **implemented (2026-06-14)**. Executed as the 9-step migration in
[PLAN-src-reorg.md](PLAN-src-reorg.md), one commit + green `/forge-verify` per step,
on `chore/src-reorg`.
Prerequisites: [RFC-001](RFC-001-NEXT-GEN-ARCHITECTURE.md) (pure core),
[RFC-002](RFC-002-SERVICES-DI-ARCHITECTURE.md) (DI container),
[RFC-003](RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) (composite scopes + dependency model).
Scope: **where code physically lives and what each layer is named.** This RFC
supersedes RFC-003 §4 (folder tree), §7 (architecture rules) and §9 (naming) on
structure only — the DI _engine_ of RFC-003 is unchanged.

---

## 0. Why reorganize

RFC-003 shipped the engine but left the tree shaped by its incremental migration:
a flat `domains/`, a separate `platform/` infra layer, an `applications/` folder, a
support sprawl (`lib/ utils/ hooks/ themes/ fixtures/ tests/`) at the `src/` root,
and a composition root buried in `app/campaignTree.ts`. As the example grew toward a
real product the names stopped carrying their weight: "applications" read like the
whole app rather than UI features; "platform" implied something below the domains
when http/telemetry are just _technical_ domains the business injects; and the
composition root looked like one more support folder.

This RFC keeps every RFC-003 guarantee and only moves/renames code so the tree reads
the way the architecture works.

## 1. The target tree

```
src/
  WebApplication.ts          # composition root — PROD/runtime host (App → Account)
  WebTest.ts                 # composition root — TEST host (same tree, zero-latency mock)

  routes/ routeTree.gen.ts router.tsx server.ts start.ts   # TanStack entries (fixed)

  framework/                 # PURE TECH — the stability boundary (UNCHANGED)
    core/ react/ services/ primitives/ canvas/

  domains/
    business/
      campaign/              # bounded context
        campaigns/ categories/ templates/
      data-management/
        fields/
    technical/               # shared infra domains, injectable by business domains
      http/ telemetry/

  features/
    campaign-editor/         # UI feature: screens, UI stores, cross-domain orchestration

  components/                # the doc app's OWN UI (Sidebar, gallery) — NOT the library

  playground/
    nav.ts                   # demo navigation config
    fixtures/                # seeded demo datasets

  shared/
    lib/    # cn (utils.ts), config.server, error-*, host integration
    utils/  # Intl formatters, perf timing (demo helpers)
    hooks/  # render-metrics, event-log, mobile
    themes/ # ThemeProvider, token catalogue

  test/
    setup.ts                 # Vitest jsdom setup (matchers + cleanup)
```

### Constraints imposed by the tooling (non-negotiable)

- `src/routes/` is the default `routesDirectory` of `@lovable.dev/vite-tanstack-config`.
- The SSR entries stay at the `src/` root: `routeTree.gen.ts` (generated, never edited
  by hand), `router.tsx`, `server.ts`, `start.ts`.

## 2. The composition root: `WebApplication` / `WebTest`

The scope tree (App → Account) is built by two host modules at the `src/` root —
one DI entry point per environment, with **prod never importing the test host**:

- **`WebApplication.ts`** — the runtime/PROD host. `buildWebApplication(api)` builds
  the App → Account tree (ex `buildCampaignTree`; type `WebApplicationTree` ex
  `CampaignTree`). This lab/doc app has no real backend, so the running demo is wired
  on a mock: `createMockApi()` is the default `api` and is **exported from this module**
  as the demo's backend.
- **`WebTest.ts`** — the TEST host. `buildWebTest()` builds the _same_ tree via
  `buildWebApplication(createMockApi({ latency: 0 }))`. Integration tests import
  `buildWebTest()` instead of hand-rolling `buildCampaignTree(fakeApi)`.

## 3. Domains: `business/<context>/<domain>` + `technical/<domain>`

A **domain** is the unit that owns its data and exposes a public barrel (`index.ts`).
Two families:

- **business** — grouped by bounded context: `business/campaign/{campaigns,categories,
templates}`, `business/data-management/{fields}`. Pure, Node-tested
  (model · dto · mapper · provider · store · service · facade), mounted at the Account
  scope.
- **technical** — shared infrastructure exposed as value tokens: `technical/{http,
telemetry}`. Any business domain may inject a technical domain (e.g. `fields`
  injects telemetry). Technical domains are therefore **exempt** from the cross-domain
  "barrel only" rule.

## 4. Features (ex applications)

`features/` holds UI features that compose `@/framework/primitives` + `domains`, own
their screen-local state (UI stores, forms), and orchestrate logic spanning several
domains. A feature must not import another feature's internals — only its public
barrel. The composition root for a feature's screen mounts `ServicesProvider` against
the current Account node and obtains the tree from `buildWebApplication()`.

## 5. Architecture rules (the contract — CI-enforced)

One-way imports, proven by `src/framework/core/purity.test.ts` and given fast editor
feedback by `eslint.config.js` (`no-restricted-imports`):

1. `framework/core` and `framework/canvas` import no React; `framework` imports no
   business layer (`@/domains`, `@/features`) and not the composition root
   (`@/WebApplication`, `@/WebTest`).
2. `domains` are pure (no React) and import no feature nor composition root.
3. A domain reaches another domain only through its public barrel — no deep import
   past the domain root. The domain root is `business/<context>/<domain>` or
   `technical/<domain>`. `technical/*` is exempt (shared infra).
4. A feature reaches another feature only through its public barrel.

## 6. Mapping from RFC-003

| RFC-003 (old)                              | RFC-004 (new)                                           |
| ------------------------------------------ | ------------------------------------------------------- |
| `app/campaignTree.ts`                      | `WebApplication.ts` (root)                              |
| `app/mockApi.ts`                           | merged into `WebApplication.ts`; test host `WebTest.ts` |
| `applications/campaign-editor/`            | `features/campaign-editor/`                             |
| `platform/http`, `platform/telemetry`      | `domains/technical/http`, `…/telemetry`                 |
| `domains/{campaigns,categories,templates}` | `domains/business/campaign/…`                           |
| `domains/fields`                           | `domains/business/data-management/fields`               |
| `playground/components/`                   | `components/`                                           |
| `fixtures/`                                | `playground/fixtures/`                                  |
| `lib/ utils/ hooks/ themes/`               | `shared/{lib,utils,hooks,themes}/`                      |
| `tests/`                                   | `test/`                                                 |
| `framework/`, `routes/`, SSR entries       | unchanged                                               |

## 7. What this RFC does NOT change

The RFC-003 engine is untouched: composite scope tree, `require`/`dependency`/`inject`,
store ownership (domain stores at the leaf, UI stores out of the container), the
provider/façade read/write split, and recursion-free invalidation. RFC-001's pure-core
rules and RFC-002's DI container are likewise unchanged.
