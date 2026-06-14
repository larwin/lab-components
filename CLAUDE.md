# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # Start development server (HMR)
bun build        # Production build
bun run lint     # ESLint across the project
bun run format   # Prettier formatting
bun run test     # Run all tests once (vitest — do NOT use `bun test`, which
                 # invokes Bun's native runner and picks up experimentations/)
bun run test:watch  # Tests in watch mode
```

To run a single test file:

```bash
bun vitest run src/framework/primitives/Listbox.test.tsx
```

## Architecture

This is a **React 19 + TypeScript component framework** (codenamed "Forge") built with TanStack Start (SSR), Tailwind CSS v4, Vitest, and Radix UI primitives. Package manager is **Bun**.

### Layer Model

```
src/WebApplication.ts → Composition root, PROD/runtime host: buildWebApplication()
                       builds the scope tree (App → Account); owns the demo mock backend.
src/WebTest.ts       → Composition root, TEST host: buildWebTest() builds the same tree
                       on a zero-latency mock. Prod never imports the test host.
src/routes/          → Playground / living documentation (TanStack file-based routing)
src/framework/       → PUBLIC API — stable contracts only; internals are refactorable
  core/              → NEXT-GEN pure core: Intent → Reducer → State → Effects.
                       behaviors, collection engine, shortcuts, Fenwick virtualizer,
                       query, i18n. NO React/DOM imports — tests run in plain Node.
  react/             → React adapter: useMachine, useKeymap, useVirtualizer,
                       effect interpreters, ShortcutProvider, services (useFacade/useStoreValue)
  services/          → DI container + invalidation (RFC-002/003): role tokens,
                       composite scopes, require/dependency/inject. NO React — plain Node.
  primitives/        → Next-gen components composed from core behaviors
                       (Button, Listbox, TreeView, DataGrid)
  canvas/            → NEXT-GEN renderer adapter #2 (canvas grid; NO React, purity-guarded)
src/domains/         → Business + technical domains (RFC-003/004). Pure, Node-tested.
  business/<context>/ → model/dto/mapper/provider/store/service/facade per domain,
                       grouped by bounded context (campaign, data-management). Mounted Account.
  technical/         → shared infra as value tokens (http ApiClient, telemetry),
                       injectable by business domains.
src/features/        → UI features (RFC-003/004): UI stores (out of container), screens,
                       cross-domain orchestration. Composed from @/framework/primitives.
src/components/      → The doc app's OWN UI (Sidebar, gallery) — NOT the library.
src/playground/      → Demo shell config: nav.ts + fixtures/ (seeded demo datasets).
src/shared/          → Support code: lib/ (cn, error/host), utils/, hooks/, themes/ (tokens+ThemeProvider).
src/test/            → Vitest setup (jsdom matchers + cleanup).
experimentations/    → Sandbox at repo root (lint-ignored); gen-2 prototype that
                       inspired the core — see docs/RFC-001
```

**`@/framework` is the stability boundary.** Props are the contract; anything inside that doesn't affect the public API can be freely rewritten.

Each significant directory has its own `README.md` (role / layer / status / inbound
usage). [src/README.md](src/README.md) is the map: the layer diagram + a grep-backed
per-directory status table (active / legacy / deprecated / isolated / support).

### Project skills

Five skills in `.claude/skills/` encode the working method — prefer them over
improvising: `/forge-feature` (build anything on the engine, RFC-001 pipeline),
`/forge-service` (business layer: domains/features/DI, RFC-002/003 pipeline),
`/forge-verify` (validation loop), `/forge-review` (review a diff against the
RFC principles), `/forge-learn` (capture session lessons back into the skills
and memory — run it at the end of significant work).

### Next-gen architecture (read this first)

[docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) is the authoritative design document. Hard rules:

- `src/framework/core` must never import React or touch the DOM. State changes only via intents; side-effects only as declarative effects interpreted by adapters.
- New interactive components are **compositions of behaviors** (`composeMachine`) plus a thin React shell; new logic goes in the core with Node-environment tests (`// @vitest-environment node`).
- Demo pages: `/engine` (live intent/effect inspector) and `/grid-next` (500k-row virtualized grid).

### Headless-first Pattern

State and rendering are separated. In the next-gen stack the separation is total (pure machines + adapters). For legacy gen-1 components the pattern is `use*.ts` hook for logic, component file for rendering (`useDataGrid` / `DataGrid`).

### Component Variants

Use `class-variance-authority` (CVA) for type-safe variant composition. Define variants declaratively in the component file (e.g., `buttonVariants`). Avoid ad-hoc conditional class strings.

### Styling

Tailwind CSS v4 with CSS variables. Use the `cn()` utility from `@/shared/lib/utils` to merge classnames. Token definitions live in `src/shared/themes/`; do not hardcode color values.

### Component usage (hard rule)

**Only use components that already exist in the project.** Any UI — demo routes included — composes exclusively from `@/framework/primitives` (and the playground helpers in `@/playground/components`). Concretely:

- **Never hand-roll a control with raw markup when a primitive exists.** Use `Listbox` for lists, `Select` for selects, `TextField`/`NumberField`/`Switch`/`Checkbox`/`Button` for inputs, `Alert`/`Badge`/`Spinner`/`Card` for feedback and containers, etc. A `<ul><li>` list of data when `Listbox` exists is a bug, not a shortcut.
- **Never pull in an external component library.** No shadcn/ui, MUI, Headless UI, etc. (The temporary `src/components/ui/` shadcn-era library was removed on 2026-06-14 — `@/framework/primitives` is the only component API.)
- **If a needed component does not exist, build it first** as a primitive following `/forge-feature` (pure machine → Node tests → thin shell), then use it. Never inline a one-off substitute.
- Raw HTML is acceptable **only** for pure layout (`div`/`span`/`section` for grids and spacing) and short prose (`p`/`ul` of explanatory text) where no component is implied.

### Routing

TanStack Start file-based routing: `src/routes/index.tsx` → `/`, `src/routes/users/$id.tsx` → `/users/:id`. `routeTree.gen.ts` is auto-generated — do not edit. Server-side code uses `*.server.ts` suffix (not `server-only` import).

### Testing

Tests are co-located next to components (`Button.tsx` → `Button.test.tsx`). Use React Testing Library + Vitest. The setup file at `src/test/setup.ts` handles `jest-dom` matchers and cleanup.

### Path Aliases

`@/*` resolves to `./src/*`. Always use the alias; never use relative `../../` imports for cross-directory references.

## Key Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Layering decisions and design philosophy
- [docs/ROADMAP.md](docs/ROADMAP.md) — Planned engines and DataGrid roadmap
- [src/framework/components/DataGrid/README.md](src/framework/components/DataGrid/README.md) — DataGrid extension points
- [src/framework/collections/README.md](src/framework/collections/README.md) — Collections engine migration strategy
