# src/playground

**Role:** the navigation structure for the living documentation plus the seeded
demo datasets used by the routes.
**Layer / generation:** support (playground).
**Status:** active.

## What lives here

- `nav.ts` — the navigation structure (route groups + titles) driving the sidebar.
- `fixtures/` — seeded demo datasets (Users / Products / Orders) for the grid and
  data-heavy routes. See [fixtures/README.md](fixtures/README.md).

The demo layout (sidebar, theme toggle) and the primitive showcase grid moved out
to `@/components` (the doc app's own UI, distinct from `@/framework/primitives`,
the library).

## Conventions / rules

- Playground helpers only — composed from `@/framework/primitives` and
  `@/shared/themes`. Not part of the stable API and not shipped as product code.
- This is the one place (with `routes/` and the `@/components` doc UI) demo data
  and navigation are allowed to live.

## Used by / depends on

- **Inbound:** ~26 routes + the campaign-editor screen.
- **Outbound:** `framework/primitives`, `shared/themes`, `react`.

## See also

- [../routes/README.md](../routes/README.md) — the pages that use this shell.
