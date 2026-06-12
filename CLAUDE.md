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
bun vitest run src/framework/components/Button.test.tsx
```

## Architecture

This is a **React 19 + TypeScript component framework** (codenamed "Forge") built with TanStack Start (SSR), Tailwind CSS v4, Vitest, and Radix UI primitives. Package manager is **Bun**.

### Layer Model

```
src/routes/          → Playground / living documentation (TanStack file-based routing)
src/framework/       → PUBLIC API — stable contracts only; internals are refactorable
  core/              → NEXT-GEN pure core: Intent → Reducer → State → Effects.
                       behaviors, collection engine, shortcuts, Fenwick virtualizer,
                       query, i18n. NO React/DOM imports — tests run in plain Node.
  react/             → React adapter: useMachine, useKeymap, useVirtualizer,
                       effect interpreters, ShortcutProvider
  primitives/        → Next-gen components composed from core behaviors
                       (Button, Listbox, TreeView, DataGrid)
  components/        → Gen-1 components (Button, Checkbox, Input, DataGrid, …)
  collections/       → Gen-1.5 contracts (superseded by core/collection)
  engines/           → Gen-1.5 descriptors (superseded by core/)
src/components/ui/   → Temporary shadcn-style UI library (not the stable API)
experimentations/    → Sandbox at repo root (lint-ignored); gen-2 prototype that
                       inspired the core — see docs/RFC-001
src/themes/          → CSS variable token catalogue + ThemeProvider
src/fixtures/        → Seeded demo datasets used in playground routes
src/hooks/           → Utility hooks (useRenderMetrics, useEventLog)
```

**`@/framework` is the stability boundary.** Props are the contract; anything inside that doesn't affect the public API can be freely rewritten.

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

Tailwind CSS v4 with CSS variables. Use the `cn()` utility from `@/lib/utils` to merge classnames. Token definitions live in `src/themes/`; do not hardcode color values.

### Routing

TanStack Start file-based routing: `src/routes/index.tsx` → `/`, `src/routes/users/$id.tsx` → `/users/:id`. `routeTree.gen.ts` is auto-generated — do not edit. Server-side code uses `*.server.ts` suffix (not `server-only` import).

### Testing

Tests are co-located next to components (`Button.tsx` → `Button.test.tsx`). Use React Testing Library + Vitest. The setup file at `src/tests/setup.ts` handles `jest-dom` matchers and cleanup.

### Path Aliases

`@/*` resolves to `./src/*`. Always use the alias; never use relative `../../` imports for cross-directory references.

## Key Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Layering decisions and design philosophy
- [docs/ROADMAP.md](docs/ROADMAP.md) — Planned engines and DataGrid roadmap
- [src/framework/components/DataGrid/README.md](src/framework/components/DataGrid/README.md) — DataGrid extension points
- [src/framework/collections/README.md](src/framework/collections/README.md) — Collections engine migration strategy
