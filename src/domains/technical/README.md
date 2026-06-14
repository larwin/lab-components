# src/domains/technical

**Role:** **technical domains** — shared infrastructure exposed as **value tokens**
that any business domain may inject without knowing the concrete implementation
(HTTP, telemetry). They live under `domains/` (alongside the business contexts),
not in a separate `platform/` layer. No business knowledge lives here.
**Layer / generation:** next-gen infra (RFC-003).
**Status:** active.

## What lives here

- `http/apiClient.ts` — the `ApiClient` interface (`get`/`post`) + `ApiClientToken`.
  The HTTP boundary; the concrete client is provided by the composition root
  (`WebApplication`).
- `telemetry/telemetry.ts` — the `Telemetry` interface + `TelemetryToken` +
  `createTelemetry()`. In the example it counts service rebuilds to make
  invalidation visible on `/services-demo`; a real app would swap in its own.

## Conventions / rules

- **Value tokens, not stores** — singletons mounted at the App node, resolved by
  walking up the scope tree.
- No React, no DOM, no business logic. Implementations are injected at the
  composition root (`WebApplication`), keeping domains testable with fakes.

## Used by / depends on

- **Inbound:** `domains/business/data-management/fields` (telemetry),
  `features/campaign-editor`, `WebApplication`/`WebTest` (provide the concrete
  instances).
- **Outbound:** `framework/services` (token helpers).

## See also

- [docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md](../../../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) — §4 platform seam, §16 open question on folding it into the composition root.
- [../README.md](../README.md) — the domains layer this is part of.
