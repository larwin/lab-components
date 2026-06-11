import type { BulkActionDef, RowActionDef } from '../definition/actions';

export function computeAvailableRowActions<TItem>(
  row: TItem,
  actions: RowActionDef<TItem>[]
): string[] {
  if (actions.length === 0) return [];

  return actions
    .filter((action) => action.isAvailable == null || action.isAvailable(row))
    .map((action) => action.id);
}

export function computeAvailableBulkActions<TItem>(
  selectedRows: TItem[],
  actions: BulkActionDef<TItem>[]
): string[] {
  if (actions.length === 0 || selectedRows.length === 0) return [];

  return actions
    .filter((action) => {
      const min = action.minSelection ?? 1;
      if (selectedRows.length < min) return false;
      return action.isAvailable == null || action.isAvailable(selectedRows);
    })
    .map((action) => action.id);
}


