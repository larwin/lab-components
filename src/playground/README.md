# src/playground

**Role:** the shell for the living documentation — the demo layout (sidebar, theme
toggle), the navigation structure, and a primitive gallery shared by the routes.
**Layer / generation:** support (playground).
**Status:** active.

## What lives here

- `nav.ts` — the navigation structure (route groups + titles) driving the sidebar.
- `components/Sidebar.tsx` — the playground layout sidebar with theme toggle.
- `components/primitives.tsx` — a primitive showcase grid reused across demo pages.

## Conventions / rules

- Playground helpers only — composed from `@/framework/primitives` and `@/themes`.
  Not part of the stable API and not shipped as product code.
- This is the one place (with `routes/`) demo UI is allowed to live.

## Used by / depends on

- **Inbound:** ~26 routes + the campaign-editor screen.
- **Outbound:** `framework/primitives`, `themes`, `react`.

## See also

- [../routes/README.md](../routes/README.md) — the pages that use this shell.
