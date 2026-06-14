# src/platform

**Role:** cross-cutting infrastructure exposed as **value tokens** — the seams the
business layer depends on without knowing the concrete implementation (HTTP,
telemetry). No business knowledge lives here.
**Layer / generation:** next-gen infra (RFC-003).
**Status:** active.

## What lives here

- `http/apiClient.ts` — the `ApiClient` interface (`get`/`post`) + `ApiClientToken`.
  The HTTP boundary; the concrete client is provided by the composition root.
- `telemetry/telemetry.ts` — the `Telemetry` interface + `TelemetryToken` +
  `createTelemetry()`. In the example it counts service rebuilds to make
  invalidation visible on `/services-demo`; a real app would swap in its own.

## Conventions / rules

- **Value tokens, not stores** — singletons mounted at the App node, resolved by
  walking up the scope tree.
- No React, no DOM, no business logic. Implementations are injected at the
  composition root (`app/`), keeping domains testable with fakes.

## Used by / depends on

- **Inbound:** `domains/fields` (telemetry), `applications/campaign-editor`,
  `app/campaignTree.ts` (provides the concrete instances).
- **Outbound:** `framework/services` (token helpers).

## See also

- [docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md](../../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) — §4 platform seam, §16 open question on folding it into `app`.
- [../app/README.md](../app/README.md) — where these tokens get their implementations.
