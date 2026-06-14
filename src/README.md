# src/

**Role:** the entire Forge source tree — a React 19 + TypeScript component framework
("Forge") plus its playground, its business-layer example, and the support code
around them.
**Layer / generation:** mixed — this directory is the map of which layer each
subfolder belongs to.

This file is the **map**. Each significant directory has its own `README.md`
following the same template; this one explains how the layers fit together and
gives the authoritative per-directory status. The current layout is described by
[docs/RFC-004-SRC-LAYOUT.md](../docs/RFC-004-SRC-LAYOUT.md).

## The layer model

Code is organised in concentric circles, plus a playground and support code.
Imports point **inward only**: `features → domains → framework`; nothing
business-related is ever imported by `framework`; and the composition root
(`WebApplication`/`WebTest`) sits **above** everything, wiring the tree.

```
WebApplication.ts   composition root (PROD/runtime host) — builds App → Account
WebTest.ts          composition root (TEST host) — same tree, zero-latency mock

┌─ playground ──────────────────────────────────────────────────────────────┐
│ routes/         TanStack file-based pages — the living documentation        │
│ playground/     demo shell config: nav.ts + fixtures/ (seeded datasets)     │
│ components/     the doc app's OWN UI (Sidebar, gallery) — NOT the library   │
│                                                                              │
│  ┌─ features/ ── UI features (RFC-003/004) ──────────────────────────────┐  │
│  │ campaign-editor: UI stores (out of container), screens,               │  │
│  │ cross-domain orchestration. Composed from @/framework/primitives.     │  │
│  │                                                                        │  │
│  │  ┌─ domains/ ── business + technical (RFC-003/004) ──────────────┐    │  │
│  │  │ business/campaign/        campaigns · categories · templates   │    │  │
│  │  │ business/data-management/ fields                               │    │  │
│  │  │ technical/                http · telemetry (shared infra,      │    │  │
│  │  │                           injected by business domains)        │    │  │
│  │  │ model · dto · mapper · provider · store · service · facade     │    │  │
│  │  │ Pure TypeScript, Node-tested, mounted at the Account scope.    │    │  │
│  │  │                                                                 │    │  │
│  │  │  ┌─ framework/ ── PUBLIC API, the stability boundary ──┐       │    │  │
│  │  │  │ core/       pure Intent→Reducer→State→Effects engine │       │    │  │
│  │  │  │ react/      the React adapter for the core           │       │    │  │
│  │  │  │ services/   DI container + invalidation (no React)   │       │    │  │
│  │  │  │ primitives/ next-gen components (Button, DataGrid, …)│       │    │  │
│  │  │  │ canvas/     2nd renderer adapter (proof of purity)   │       │    │  │
│  │  │  └──────────────────────────────────────────────────────┘      │    │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ shared/  support code: lib/ (cn, error/host) · utils/ · hooks/ · themes/     │
│ test/    Vitest setup (jsdom matchers + cleanup)                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

`@/framework` is the **stability boundary**: its component props are the contract.
Anything inside that doesn't change the public API can be freely rewritten. New UI
imports from the specific subpath (`@/framework/primitives`, `@/framework/core`, …);
there is no longer a root `@/framework` barrel.

The **composition root** lives at the `src/` root as two hosts: `WebApplication.ts`
(the runtime/demo host — `buildWebApplication()` builds the App → Account scope tree
and defaults to the mock backend, since this lab app has no real server) and
`WebTest.ts` (the test host — `buildWebTest()` builds the SAME tree on a zero-latency
mock). One DI entry point per environment; prod never imports the test host. The
**fixed TanStack entries** (`routes/`, `routeTree.gen.ts`, `router.tsx`, `server.ts`,
`start.ts`) also stay at the `src/` root — the tooling requires it.

## Generations

Forge is **single-generation**: only the next-gen stack remains. The legacy layers
were removed on 2026-06-14 (see [docs/PLAN-src-cleanup.md](../docs/PLAN-src-cleanup.md)),
and the tree was reorganized on 2026-06-14 (see
[docs/PLAN-src-reorg.md](../docs/PLAN-src-reorg.md) / RFC-004).

- **next-gen (RFC-001/002/003/004)** — the pure-core engine (`core`), its adapters
  (`react`, `canvas`), the DI layer (`services`), the next-gen `primitives`, the
  business layers (`domains/business`, `domains/technical`, `features`), and the
  composition root (`WebApplication`/`WebTest`). **This is where all code goes.**
- **removed (2026-06-14)** — the gen-1 `framework/components`, the gen-1.5
  `framework/collections` and `framework/engines` descriptors, the shadcn
  `components/ui` library, the `lib/api` example, the root `@/framework` barrel, and
  7 gen-1 demo routes (`/components`, `/collections`, `/data-grid`, `/virtualization`,
  `/accessibility`, `/theming`, `/debug`). The two flagship grids (`/grid-next`,
  `/canvas-grid`) were kept and switched from the gen-1 `Select` to the `primitives`
  `Select`.

## Per-directory status (grep-backed, 2026-06-14)

"Inbound" = files outside the directory (and its own tests) that import it.

| Directory                  | Layer / gen        | Status               | Inbound evidence                                  |
| -------------------------- | ------------------ | -------------------- | ------------------------------------------------- |
| `WebApplication.ts`        | composition root   | **active**           | `CampaignEditorScreen`, `WebTest`                 |
| `WebTest.ts`               | composition root   | **active**           | `campaign-editor` integration test                |
| `framework/core`           | next-gen RFC-001   | **active**           | react, canvas, primitives, services, domains      |
| `framework/react`          | next-gen RFC-001   | **active**           | primitives, routes, features                      |
| `framework/services`       | next-gen RFC-002/3 | **active**           | WebApplication, domains, features, react/services |
| `framework/primitives`     | next-gen RFC-001   | **active**           | every feature route, features, canvas             |
| `framework/canvas`         | next-gen RFC-001   | **active**           | `/canvas-grid` route                              |
| `domains/business/*`       | business RFC-003/4 | **active**           | `WebApplication`, `features/campaign-editor`      |
| `domains/technical/*`      | infra RFC-003/4    | **active**           | business domains, `WebApplication`                |
| `features/campaign-editor` | UI RFC-003/4       | **active**           | `WebApplication`, `/services-demo` route          |
| `routes`                   | playground         | **active (support)** | the demo app itself                               |
| `playground`               | support            | **active**           | ~20 routes (`nav.ts`); `fixtures/` by grid routes |
| `components`               | doc-app UI         | **active**           | `__root`, routes (Sidebar, gallery)               |
| `shared/lib`               | support            | **active**           | `shared/lib/utils` (`cn`) ubiquitous              |
| `shared/utils`             | support            | **active**           | grid/perf demo files                              |
| `shared/hooks`             | support            | **active**           | `use-render-metrics`/`use-event-log` (debug)¹     |
| `shared/themes`            | support            | **active**           | `__root`, routes, playground sidebar              |
| `test`                     | support            | **active**           | `vitest.config.ts` `setupFiles`                   |

¹ `shared/hooks/use-mobile` lost its only live consumer when `components/ui` was
removed; it now survives only in the lint-ignored `experimentations/` sandbox — a
future removal candidate.

## See also

- [docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](../docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) — the pure-core engine (authoritative).
- [docs/RFC-002-SERVICES-DI-ARCHITECTURE.md](../docs/RFC-002-SERVICES-DI-ARCHITECTURE.md) — DI container + services.
- [docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md](../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) — domains/applications + composite scopes (superseded on structure by RFC-004).
- [docs/RFC-004-SRC-LAYOUT.md](../docs/RFC-004-SRC-LAYOUT.md) — the current `src/` layout (hosts, business/technical domains, features, shared).
- [docs/PLAN-src-cleanup.md](../docs/PLAN-src-cleanup.md) — the cleanup record (what was removed and why).
- [CLAUDE.md](../CLAUDE.md) — the working rules (this map is consistent with its Layer Model).
