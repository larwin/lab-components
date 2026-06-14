# src/lib

**Role:** app-level utilities and host integration — the `cn()` class-name merge,
server config, error capture, and a server-function example. Distinct from
`platform/` (which is DI infra) and `utils/` (which is demo formatting).
**Layer / generation:** support.
**Status:** active — except `lib/api` (dead example, see below).

## What lives here

- `utils.ts` — **`cn()`** (clsx + tailwind-merge). The canonical class-name merge
  referenced as `@/lib/utils` across the whole codebase.
- `config.server.ts` — server-only config (Cloudflare-Workers-safe).
- `error-capture.ts` — out-of-band global error recorder.
- `error-page.ts` — HTML error fallback template.
- `lovable-error-reporting.ts` — Lovable IDE error bridge.

> `lib/api/` (a sample TanStack `createServerFn`) was removed on 2026-06-14 — it had
> no importers. The DI HTTP boundary is `platform/http` (`ApiClient`).

## Conventions / rules

- `cn()` is the single class-name merge utility; do not reintroduce another.
- The DI HTTP boundary the business layer uses is `platform/http` (`ApiClient`
  token), **not** a `lib/` helper.

## Used by / depends on

- **Inbound:** `@/lib/utils` — 100+ files (primitives, demos); error/config files —
  the app entrypoints (`start`, `server`, `__root`).
- **Outbound:** `clsx`, `tailwind-merge`, `zod`, TanStack Start.

## See also

- [../platform/README.md](../platform/README.md) — the DI HTTP boundary (not this).
- [../utils/README.md](../utils/README.md) — demo formatting helpers.
