# src/shared/utils

**Role:** presentation and measurement helpers for the playground — Intl formatters
and performance timing used by the grid/benchmark demos.
**Layer / generation:** support.
**Status:** active.

## What lives here

- `format.ts` — Intl-based formatters (number, currency, date, titleCase).
- `perf.ts` — `measure()`, a `Timer` class, `formatDuration()`, `DATASET_SIZES`.

## Conventions / rules

- Demo/benchmark helpers. Locale-aware _interaction_ logic (sort/typeahead collators,
  date/number machines) lives in `@/framework/core/i18n`, `core/date`, `core/time` —
  not here.

## Used by / depends on

- **Inbound:** ~13 files — the grid/data/virtualization demo routes and benchmarks
  (`data-grid`, `grid-next`, `data-loader`, `canvas-grid`, `kanban`, `virtualization`,
  `debug`).
- **Outbound:** `Intl` (built-in).

## See also

- [../lib/README.md](../lib/README.md) — `cn()` and host utilities.
