# src/framework/services

**Role:** a ~250-line hand-rolled dependency-injection container with reactive,
recursion-free invalidation — the framework-agnostic plumbing the business layer
(`domains`, `applications`) wires itself onto.
**Layer / generation:** next-gen (RFC-002, upgraded to composite scopes by RFC-003).
**Status:** active.

## What lives here

- `container/token.ts` — **role-branded tokens** (`valueToken`, `storeToken`,
  `serviceToken`, `facadeToken`). The role steers every wiring decision so you
  cannot connect the wrong kind of thing — the compiler refuses it.
- `container/container.ts` — `createContainer`, the composite scope nodes, the
  `define*` helpers (`defineValue`/`defineStore`/`defineService`/`defineFacade`/
  `defineSingleton`/`defineTransient`), `require`/`dependency`/`inject`, `validate()`
  (eager cycle detection), and the precomputed reverse-reach invalidation walk.
- `container/container.test.ts` — the guarantees: lifetimes, cycle rejection,
  "rebuild exactly once", surgical invalidation, "live store never dropped",
  per-node owner resolution, account-switch isolation.

## Conventions / rules

- **Imports no React** — enforced by `core/purity.test.ts`. The React binding lives
  in [`../react/services`](../react/README.md).
- Three lifetimes only: `transient` / `singleton` / `scoped`.
- `inject` is the default (build + stay fresh); `require` (snapshot) and
  `dependency` (pure listener) are the explicit, reviewable specials.
- The dependency graph is plain inspectable data — no decorators, no `reflect-metadata`.

## Used by / depends on

- **Inbound:** `app` (builds the tree), `domains/*` (register stores/services/facades),
  `applications/*`, `framework/react/services` (the React hooks).
- **Outbound:** `framework/core` — the `Store` type only.

## See also

- [docs/RFC-002-SERVICES-DI-ARCHITECTURE.md](../../../docs/RFC-002-SERVICES-DI-ARCHITECTURE.md) — the container API + decisions.
- [docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md](../../../docs/RFC-003-INDUSTRIAL-DOMAIN-ARCHITECTURE.md) — composite scopes + the three-primitive model.
