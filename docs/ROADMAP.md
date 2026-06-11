# Forge — Roadmap & Design Goals

## Design goals

1. **Architecture over features.** A clean, legible structure that scales.
2. **Collection-first.** Lists, trees, menus and grids share one mental model.
3. **Headless where it counts.** State separated from rendering.
4. **Performance-aware.** Seeded datasets + timing utilities from day one.
5. **Accessible by default.** Keyboard, focus and ARIA built into primitives.
6. **AI-evolvable.** Stable contracts + reserved extension points.

## Engine roadmap

Defined in `src/framework/engines/index.ts`. None are implemented yet — they are
deliberate seams.

| Engine          | Status        | Lands in                              |
| --------------- | ------------- | ------------------------------------- |
| Collection      | experimental  | `src/framework/collections`           |
| Behaviors       | planned       | `src/framework/engines/behaviors`     |
| Intents         | planned       | `src/framework/engines/intents`       |
| State machines  | planned       | `src/framework/engines/state-machines`|
| Effects         | planned       | `src/framework/engines/effects`       |
| Virtualization  | planned       | `src/framework/engines/virtualization`|
| Accessibility   | planned       | `src/framework/engines/accessibility` |

## Data Grid roadmap

See `src/framework/components/DataGrid/README.md`. Near-term targets: virtualized
row renderer, per-column filters, multi-sort, column pinning/resizing, inline
editing — all additive to the existing `ColumnDef` and `useDataGrid` contracts.

## For the next agent

- Start from `docs/ARCHITECTURE.md` to learn the layering.
- Implement one engine behind its declared interface; migrate one component.
- Never break a `@/framework` component's public props — extend, don't rewrite.
- Add tests next to the component (`*.test.tsx`) and benchmarks with `utils/perf`.
