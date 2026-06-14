# src/framework

**Role:** the public, stable API of Forge — components and the engine that powers
them. This is the one boundary the rest of the repo (and any future consumer)
depends on.
**Layer / generation:** mixed — holds next-gen (RFC-001/002/003), gen-1 and gen-1.5
code side by side. New code is next-gen only.
**Status:** active. **`@/framework` is the stability boundary**: props are the
contract; internals are refactorable.

## What lives here

Next-gen (RFC-001/002/003) — where all new code goes:

- [`core/`](core/README.md) — the pure engine: `Intent → Reducer → State → Effects`.
  No React, no DOM. The actual product.
- [`react/`](react/README.md) — the React adapter for the core (`useMachine`,
  effect interpreters, shortcuts, virtualizer, the `services` DI hooks).
- [`services/`](services/README.md) — the DI container + invalidation (RFC-002/003).
  No React.
- [`primitives/`](primitives/README.md) — next-gen components composed from core
  behaviors + a thin React shell (Button, Listbox, TreeView, DataGrid, …).
- [`canvas/`](canvas/README.md) — a second renderer adapter (canvas), proving the
  core is renderer-agnostic.

> Removed 2026-06-14: the gen-1 `components/`, the gen-1.5 `collections/` +
> `engines/` descriptors, and the root `index.ts` barrel that re-exported them.
> Import from the specific subpath (`@/framework/primitives`, `@/framework/core`, …);
> there is no root `@/framework` barrel anymore. See
> [docs/PLAN-src-cleanup.md](../../docs/PLAN-src-cleanup.md).

## Conventions / rules

- **`core/` and `services/` import no React and touch no DOM** — enforced by
  `core/purity.test.ts`. State changes only through intents; side-effects only as
  declarative effects interpreted by adapters.
- New interactive components are **compositions of behaviors** (`composeMachine`)
  plus a thin React shell. New logic goes in `core/` with Node tests.
- `framework/**` imports only `framework` — never `domains`, `applications`,
  `app`, or `platform`.

## Used by / depends on

- **Inbound:** `routes`, `playground`, `domains`, `applications`, `app`.
- **Outbound:** `react` (the framework lib) only; nothing in the repo's business
  layers.

## See also

- [docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](../../docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) — authoritative design.
- [../README.md](../README.md) — the src/ map and full status table.
