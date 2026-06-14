# src/playground/fixtures

**Role:** seeded demo datasets — deterministic generators for Users / Products /
Orders used by the grid and data-heavy playground routes.
**Layer / generation:** support.
**Status:** active.

## What lives here

- `types.ts` — `User`, `Product`, `Order` interfaces.
- `random.ts` — seeded RNG utilities (deterministic output).
- `datasets.ts` — generators: `getUsers`, `getProducts`, `getOrders`.
- `index.ts` — the barrel.

## Conventions / rules

- Demo data only. Deterministic (seeded) so benchmarks and snapshots are stable.
- Not product data and not test fixtures for unit tests (those are inline / Node-tested).

## Used by / depends on

- **Inbound:** 6 routes — `data-grid`, `grid-next`, `data-loader`, `canvas-grid`,
  `kanban`, `virtualization`.
- **Outbound:** nothing.

## See also

- [../../routes/README.md](../../routes/README.md)
