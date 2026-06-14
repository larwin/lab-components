# src/framework/react

**Role:** the React adapter for the pure core — one adapter among several possible
(Vue/Solid/canvas). It runs machines, interprets effects, and binds stores to
React; it holds no interaction logic of its own.
**Layer / generation:** next-gen (RFC-001) adapter.
**Status:** active.

## What lives here

- `useMachine.ts` — drives a core machine from React; dispatches intents, exposes
  state, runs the effect queue.
- `effects.ts` + `useForgeEffects` — interpret core `Effect`s (focus, scroll,
  announce, restore-focus, emit-event, load-data). Overridable per effect type
  (that's how DataGrid reroutes `ScrollToItem` into the virtualizer).
- `useKeymap.ts` — platform-aware key detection + binding resolution.
- `useVirtualizer.ts` — React binding over the core Fenwick virtualizer (rAF-coalesced).
- `shortcuts.tsx` — `ShortcutProvider` + the scope-tree context.
- `overlay.tsx` — the single floating-surface engine (portal, layer stack, focus
  trap/restore, anchored tracking, blocking scopes).
- `useDataSource.ts` — binds the core loader machine to `AbortController`.
- `services/` — the React DI adapter: `ServicesProvider`, `useFacade`,
  `useStoreValue` (RFC-002/003).

## Conventions / rules

- The **only** layer allowed to import both `react` and `@/framework/core`.
- Mechanical wiring only — **no business logic, no interaction algorithms** (those
  live in `core`).
- A new framework adapter reimplements these few modules; the core moves unchanged.

## Used by / depends on

- **Inbound:** `framework/primitives`, `routes`, `applications`.
- **Outbound:** `framework/core`, `framework/services` (token/Store types), `react`.

## See also

- [docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](../../../docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) — §4.8 overlays, §7 extension cookbook.
- [../services/README.md](../services/README.md) — the DI container these hooks adapt.
