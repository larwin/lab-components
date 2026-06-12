# Forge — Architecture

> **The next-generation architecture lives in
> [RFC-001](./RFC-001-NEXT-GEN-ARCHITECTURE.md)** — pure core
> (`src/framework/core`), React adapter (`src/framework/react`), composed
> primitives (`src/framework/primitives`). This document describes the
> original gen-1 layering, which still hosts the playground and legacy
> components.

Forge is a developer playground and clean architecture foundation for a
next-generation React component framework. It runs on **React 19 + TypeScript +
Vite** (via TanStack Start), styled with **Tailwind v4** tokens.

## Layered design

```
playground (routes + showcase UI)
        │  consumes
        ▼
@/framework  ── public component surface (stable contracts)
        │  composed of
        ▼
components · collections · engines (extension points)
        │  fed by
        ▼
fixtures · hooks · utils · themes
```

## Folders

| Path                         | Responsibility                                      |
| ---------------------------- | --------------------------------------------------- |
| `src/routes/`                | Playground pages (file-based routing).              |
| `src/playground/`            | Navigation, showcase cards, controls, metrics.      |
| `src/framework/`             | The component framework. Import via `@/framework`.  |
| `src/framework/components/`  | Button, Input, List, Tree, Menu, DataGrid, …        |
| `src/framework/collections/` | Unified collection engine contracts (experimental). |
| `src/framework/engines/`     | Reserved extension points (behaviors, intents …).   |
| `src/fixtures/`              | Seeded demo datasets (users, products, orders).     |
| `src/hooks/`                 | `useRenderMetrics`, `useEventLog`.                  |
| `src/themes/`                | Theme provider + token catalogue.                   |
| `src/utils/`                 | Timing + formatting helpers.                        |
| `src/tests/`                 | Test setup; tests are co-located with components.   |

## Stability boundary

The **public surface is `@/framework`**. Component props are the contract. Internal
files (engines, collection model, row renderers) may be rewritten freely as long
as those props stay stable. This is what lets future agents evolve the internals
without breaking the playground.

## Headless-first

State and rendering are separated wherever it matters:

- `useDataGrid` owns sort/filter/selection; `DataGrid` only renders.
- Collection components implement items/selection/navigation locally today, with
  `collections/` defining the target unified model.
