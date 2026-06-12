/**
 * @forge/canvas — the second renderer adapter.
 *
 * Proof that the core is the product: the same grid machine, virtualizer,
 * query core and keymaps that power the React DataGrid drive an
 * immediate-mode canvas painter. No React imports anywhere in this folder
 * (enforced by src/framework/core/purity.test.ts).
 */

export {
  mountCanvasGrid,
  type CanvasGridOptions,
  type CanvasGridHandle,
  type CanvasColumn,
} from "./gridRenderer";
