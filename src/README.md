# src/

**Role:** the entire Forge source tree — a React 19 + TypeScript component framework
("Forge") plus its playground, its business-layer example, and the support code
around them.
**Layer / generation:** mixed — this directory is the map of which layer each
subfolder belongs to.

This file is the **map**. Each significant directory has its own `README.md`
following the same template; this one explains how the layers fit together and
gives the authoritative per-directory status.

## The layer model

Code is organised in three concentric circles, plus a playground and support code.
Imports point **inward only**: `applications → domains → framework`, and nothing
business-related is ever imported by `framework`.

```
┌─ playground ──────────────────────────────────────────────────────────┐
│ routes/        TanStack file-based pages — the living documentation     │
│ playground/    demo shell (sidebar, nav, primitive gallery)             │
│ fixtures/      seeded demo datasets                                     │
│                                                                          │
│  ┌─ applications/ ── UI features (RFC-003) ──────────────────────────┐  │
│  │ campaign-editor: UI stores (out of container), screens,           │  │
│  │ cross-domain orchestration. Composed from @/framework/primitives. │  │
│  │                                                                    │  │
│  │  ┌─ domains/ ── business (RFC-003) ──────────────────────────┐    │  │
│  │  │ categories / templates / fields / campaigns                │    │  │
│  │  │ model · dto · mapper · provider · store · service · facade │    │  │
│  │  │ Pure TypeScript, Node-tested, mounted at the Account scope. │    │  │
│  │  │                                                             │    │  │
│  │  │  ┌─ framework/ ── PUBLIC API, the stability boundary ──┐    │    │  │
│  │  │  │ core/       pure Intent→Reducer→State→Effects engine │    │    │  │
│  │  │  │ react/      the React adapter for the core            │   │    │  │
│  │  │  │ services/   DI container + invalidation (no React)    │   │    │  │
│  │  │  │ primitives/ next-gen components (Button, DataGrid, …) │   │    │  │
│  │  │  │ canvas/     2nd renderer adapter (proof of purity)    │   │    │  │
│  │  │  └───────────────────────────────────────────────────────┘   │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│ platform/  cross-cutting infra as value tokens (http, telemetry)         │
│ app/       composition root — builds the scope tree (App → Account)      │
│ themes/ lib/ utils/ hooks/ tests/  support code                          │
└──────────────────────────────────────────────────────────────────────────┘
```

`@/framework` is the **stability boundary**: its component props are the contract.
Anything inside that doesn't change the public API can be freely rewritten. New UI
imports from the specific subpath (`@/framework/primitives`, `@/framework/core`, …);
there is no longer a root `@/framework` barrel.

## Generations

Forge is now **single-generation**: only the next-gen stack remains. The legacy
layers were removed on 2026-06-14 (see [docs/PLAN-src-cleanup.md](../docs/PLAN-src-cleanup.md)).

- **next-gen (RFC-001/002/003)** — the pure-core engine (`core`), its adapters
  (`react`, `canvas`), the DI layer (`services`), the next-gen `primitives`, and
  the business layers (`domains`, `applications`, `platform`, `app`). **This is
  where all code goes.**
- **removed (2026-06-14)** — the gen-1 `framework/components`, the gen-1.5
  `framework/collections` and `framework/engines` descriptors, the shadcn
  `components/ui` library, the `lib/api` example, the root `@/framework` barrel, and
  7 gen-1 demo routes (`/components`, `/collections`, `/data-grid`, `/virtualization`,
  `/accessibility`, `/theming`, `/debug`). The two flagship grids (`/grid-next`,
  `/canvas-grid`) were kept and switched from the gen-1 `Select` to the `primitives`
  `Select`.

## Per-directory status (grep-backed, 2026-06-14)

"Inbound" = files outside the directory (and its own tests) that import it.

| Directory                      | Layer / gen        | Status               | Inbound evidence                              |
| ------------------------------ | ------------------ | -------------------- | --------------------------------------------- |
| `framework/core`               | next-gen RFC-001   | **active**           | react, canvas, primitives, services, domains  |
| `framework/react`              | next-gen RFC-001   | **active**           | primitives, routes, applications              |
| `framework/services`           | next-gen RFC-002/3 | **active**           | app, domains, applications, react/services    |
| `framework/primitives`         | next-gen RFC-001   | **active**           | every feature route, applications, canvas     |
| `framework/canvas`             | next-gen RFC-001   | **active**           | `/canvas-grid` route                          |
| `domains/*`                    | business RFC-003   | **active**           | `app`, `applications/campaign-editor`         |
| `applications/campaign-editor` | UI RFC-003         | **active**           | `app`, `/services-demo` route                 |
| `platform/http`,`telemetry`    | infra RFC-003      | **active**           | domains, app                                  |
| `app`                          | composition root   | **active**           | `/services-demo` route                        |
| `routes`                       | playground         | **active (support)** | the demo app itself                           |
| `playground`                   | support            | **active**           | ~20 routes                                    |
| `fixtures`                     | support            | **active**           | grid/data routes                              |
| `hooks`                        | support            | **active**           | `use-render-metrics`/`use-event-log` (debug)¹ |
| `lib`                          | support            | **active**           | `lib/utils` (`cn`) ubiquitous                 |
| `utils`                        | support            | **active**           | grid/perf demo files                          |
| `themes`                       | support            | **active**           | `__root`, routes, playground sidebar          |
| `tests`                        | support            | **active**           | `vitest.config.ts` `setupFiles`               |

¹ `hooks/use-mobile` lost its only live consumer when `components/ui` was removed;
it now survives only in the lint-ignored `experimentations/` sandbox — a future
removal candidate.

## See also

- [docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](../docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) — the pure-core engine (authoritative).
- [docs/RFC-002-SERVICES-DI-ARCHITECTURE.md](../docs/RFC-002-SERVICES-DI-ARCHITECTURE.md) — DI container + services.
- [docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md](../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) — domains/applications + composite scopes.
- [docs/PLAN-src-cleanup.md](../docs/PLAN-src-cleanup.md) — the cleanup record (what was removed and why).
- [CLAUDE.md](../CLAUDE.md) — the working rules (this map is consistent with its Layer Model).
