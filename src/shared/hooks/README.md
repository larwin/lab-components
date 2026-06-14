# src/shared/hooks

**Role:** small utility React hooks for the playground — render metrics, an event
log, and a mobile-breakpoint detector.
**Layer / generation:** support.
**Status:** active.

## What lives here

- `use-render-metrics.ts` — render count / duration / average (the `/debug` page).
- `use-event-log.ts` — an in-memory event log (the `/debug` page).
- `use-mobile.tsx` — `useIsMobile()` breakpoint detector.

## Conventions / rules

- Generic, app-level React hooks (not framework primitives). Interaction logic
  belongs in `@/framework/core`, not here.

## Used by / depends on

- **Inbound:** `use-render-metrics` + `use-event-log` are used by the `/debug`-style
  introspection demos. `use-mobile` has **no live consumer** since `components/ui`
  was removed (2026-06-14) — it survives only in the lint-ignored `experimentations/`
  sandbox and is a future removal candidate.
- **Outbound:** `react`.

## See also

- [../../README.md](../../README.md) — status table.
