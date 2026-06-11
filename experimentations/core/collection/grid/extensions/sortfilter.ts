import type { ColumnCoreDef } from '../definition/column.core';
import { applySortFilter } from '../controllers/sortfilter.pipeline';
import type { FilterExpr, SortSpec } from '../state/types';
import type { ItemId } from '@/core/collection/shared/runtime';

export function applyGridSortFilter<TItem, TId extends ItemId>(
  rows: TItem[],
  getRowId: (row: TItem) => TId,
  sortSpec: SortSpec[],
  filterExpr: FilterExpr | null,
  columns: Array<ColumnCoreDef<TItem>>
): TItem[] {
  const orderedIds: TId[] = [];
  const rawById = new Map<TId, TItem>();
  for (const row of rows) {
    const rowId = getRowId(row);
    orderedIds.push(rowId);
    rawById.set(rowId, row);
  }

  const sortedFilteredIds = applySortFilter(
    orderedIds,
    rawById,
    sortSpec,
    filterExpr,
    columns,
  );

  return sortedFilteredIds
    .map((rowId) => rawById.get(rowId))
    .filter((row): row is TItem => row != null);
}




