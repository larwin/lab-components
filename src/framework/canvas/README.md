# src/framework/canvas

**Role:** a second renderer adapter — an immediate-mode `<canvas>` painter for the
DataGrid that reuses the _same_ grid machine, Fenwick virtualizer, sort core and
keymap as the React grid. It exists to **prove the core is renderer-agnostic**.
**Layer / generation:** next-gen (RFC-001) adapter #2.
**Status:** active (demo at `/canvas-grid`, 1M rows).

## What lives here

- `gridRenderer.ts` — `mountCanvasGrid(...)`: draws grid state to a 2D context,
  handles scroll/keyboard by dispatching the shared grid intents.
- `index.ts` — `mountCanvasGrid` + `CanvasGridOptions` / `CanvasGridHandle` /
  `CanvasColumn` types.

## Conventions / rules

- **Imports no React** — enforced by `core/purity.test.ts`. This is the guarantee
  the whole "renderer is swappable" claim rests on.
- Reuses `@/framework/primitives/datagrid/gridMachine` (the machine is shared, not
  reimplemented) and the `core` virtualizer/sort — it adds only painting + input
  plumbing.

## Used by / depends on

- **Inbound:** the `/canvas-grid` demo route.
- **Outbound:** `framework/core`, `framework/primitives` (`gridMachine` + keymap).

## See also

- [docs/RFC-001-NEXT-GEN-ARCHITECTURE.md](../../../docs/RFC-001-NEXT-GEN-ARCHITECTURE.md) — §5 "Renderer adapter #2 — canvas", §7 "New adapter".
