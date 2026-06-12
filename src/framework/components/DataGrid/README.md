# DataGrid Architecture

The DataGrid is expected to become a flagship component. The current
implementation is deliberately small but structured so each concern can evolve
on its own.

## Separation of concerns

| Concern                    | Where it lives                    | How it evolves                         |
| -------------------------- | --------------------------------- | -------------------------------------- |
| State (sort/filter/select) | `useDataGrid.ts` (headless)       | Swap algorithms, add server-side modes |
| Column model               | `types.ts` (`ColumnDef`)          | Add grouping, pinning, resizing fields |
| Row rendering              | `DataGrid.tsx` + `renderRow` prop | Provide a virtualized row renderer     |
| Cell rendering             | `ColumnDef.cell`                  | Per-column editors, formatters         |
| Sorting                    | `useDataGrid` comparator          | Multi-sort, custom comparators         |
| Filtering                  | `useDataGrid` predicate           | Per-column filters, query DSL          |

## Extension points

- **Virtualization**: pass a custom `renderRow` that windows rows. The headless
  state already returns the full processed `rows` array — a windowing layer can
  slice it without changing `useDataGrid`.
- **Server data**: replace the in-memory `filtered`/`rows` memos with a data
  source adapter; keep the same return shape from `useDataGrid`.
- **Editing**: add an `onCellEdit` to `ColumnDef` and render inputs in `cell`.

## Rules

- Keep `useDataGrid` rendering-agnostic. It must never import React DOM nodes.
- Keep `ColumnDef` the single source of truth for column behavior.
- New features should be additive to these contracts, not rewrites.
