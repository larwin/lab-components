import type { BulkActionDef, RowActionDef } from '../definition/actions';
import { computeAvailableBulkActions, computeAvailableRowActions } from '../controllers/actions.controller';

export function computeGridRowActions<T>(row: T, actions: RowActionDef<T>[]): string[] {
  return computeAvailableRowActions(row, actions);
}

export function computeGridBulkActions<T>(selectedRows: T[], actions: BulkActionDef<T>[]): string[] {
  return computeAvailableBulkActions(selectedRows, actions);
}


