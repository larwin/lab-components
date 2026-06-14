# src/shared/lib

**Role:** app-level utilities and host integration — the `cn()` class-name merge,
server config, error capture, and a server-function example. Distinct from
`domains/technical/` (DI infra) and `shared/utils/` (demo formatting).
**Layer / generation:** support.
**Status:** active — except `lib/api` (dead example, see below).

## What lives here

- `utils.ts` — **`cn()`** (clsx + tailwind-merge). The canonical class-name merge
  referenced as `@/shared/lib/utils` across the whole codebase.
- `config.server.ts` — server-only config (Cloudflare-Workers-safe).
- `error-capture.ts` — out-of-band global error recorder.
- `error-page.ts` — HTML error fallback template.
- `lovable-error-reporting.ts` — Lovable IDE error bridge.

> `lib/api/` (a sample TanStack `createServerFn`) was removed on 2026-06-14 — it had
> no importers. The DI HTTP boundary is `domains/technical/http` (`ApiClient`).

## Conventions / rules

- `cn()` is the single class-name merge utility; do not reintroduce another.
- The DI HTTP boundary the business layer uses is `domains/technical/http` (`ApiClient`
  token), **not** a `lib/` helper.

## Used by / depends on

- **Inbound:** `@/shared/lib/utils` — 100+ files (primitives, demos); error/config files —
  the app entrypoints (`start`, `server`, `__root`).
- **Outbound:** `clsx`, `tailwind-merge`, `zod`, TanStack Start.

## See also

- [../../domains/technical/README.md](../../domains/technical/README.md) — the DI HTTP boundary (not this).
- [../utils/README.md](../utils/README.md) — demo formatting helpers.
