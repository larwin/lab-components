# Collection Engine (experimental)

Collections are central to Forge. Lists, trees, menus and grids all reduce to
the same primitives: **items**, **selection**, and **navigation/focus**.

## Current state

Each collection component (`List`, `Tree`, `Menu`, `DataGrid`) implements these
concerns locally. This keeps them simple and independently evolvable.

## Target

Converge them onto the contracts in `index.ts`:

- `CollectionItem` — normalized item with `key`, `value`, optional `children`
- `SelectionState` — `none | single | multiple`
- `NavigationState` — focused key + expanded keys
- `CollectionEngine` — the headless driver

## How to evolve safely

1. Implement an engine behind `CollectionEngine` without touching components.
2. Migrate one component (start with `List`) to consume the engine.
3. Keep each component's existing public props stable during migration.
4. Repeat for `Tree`, `Menu`, then the `DataGrid` row model.

Do not break the existing component prop contracts — they are the stability
boundary for everything that consumes Forge.
