# src/themes

**Role:** the theming layer — the light/dark `ThemeProvider` + `useTheme` hook and
the CSS-variable design-token catalogue.
**Layer / generation:** support.
**Status:** active.

## What lives here

- `theme-provider.tsx` — `ThemeProvider` + `useTheme` (light/dark).
- `tokens.ts` — the design-token catalogue (references to the CSS variables).

## Conventions / rules

- Tailwind v4 + CSS variables. Use `cn()` from `@/lib/utils` to merge classes; never
  hardcode colour values — reference the tokens.

## Used by / depends on

- **Inbound:** `routes/__root.tsx`, `overlays`/`theming` routes, the playground
  sidebar.
- **Outbound:** `react`.

## See also

- [../../CLAUDE.md](../../CLAUDE.md) — the Styling rules.
