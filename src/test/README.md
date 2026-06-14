# src/test

**Role:** the shared Vitest setup — registers jest-dom matchers and Testing Library
cleanup for the jsdom-environment tests.
**Layer / generation:** support.
**Status:** active.

## What lives here

- `setup.ts` — `@testing-library/jest-dom` matchers + `afterEach(cleanup)`.

## Conventions / rules

- Wired via `setupFiles: ["./src/test/setup.ts"]` in `vitest.config.ts`.
- Component tests use jsdom; **core/services/domain tests run in plain Node**
  (`// @vitest-environment node`) and do not rely on this setup.
- Run tests with `bun run test` (vitest) — **not** `bun test` (Bun's native runner
  ingests `experimentations/` and lacks this setup).

## Used by / depends on

- **Inbound:** Vitest, globally, before every test file.
- **Outbound:** `@testing-library/*`.

## See also

- [docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](../../docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) — §6 the `bun run test` vs `bun test` decision.
