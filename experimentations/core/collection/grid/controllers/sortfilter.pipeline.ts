import type { Culture } from '@/core/culture';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ColumnCoreDef } from '../definition/column.core';
import type { FilterExpr, SortSpec } from '../state/types';

const NO_CULTURE = {} as Culture;

export function applyFilter<TItem, TId extends ItemId>(
  ids: TId[],
  rawById: Map<TId, TItem>,
  expr: FilterExpr | null,
  columns: Array<ColumnCoreDef<TItem>>
): TId[] {
  if (!expr) return ids;

  const colMap = new Map(columns.map((column) => [column.id, column]));

function matchRow(row: TItem, filterExpr: FilterExpr): boolean {
    switch (filterExpr.kind) {
      case 'leaf': {
        const col = colMap.get(filterExpr.columnId);
        if (!col) return true;
        const value = col.getValue(row, col.id, NO_CULTURE);
        switch (filterExpr.op) {
          case 'eq': return value === filterExpr.value;
          case 'neq': return value !== filterExpr.value;
          case 'contains':
            return String(value ?? '').toLowerCase().includes(String(filterExpr.value ?? '').toLowerCase());
          case 'gt': return Number(value) > Number(filterExpr.value);
          case 'lt': return Number(value) < Number(filterExpr.value);
          case 'in':
            return Array.isArray(filterExpr.value) ? filterExpr.value.includes(value) : false;
          case 'notIn':
            return Array.isArray(filterExpr.value) ? !filterExpr.value.includes(value) : false;
          default: return true;
        }
      }
      case 'and': return filterExpr.children.every((child) => matchRow(row, child));
      case 'or': return filterExpr.children.some((child) => matchRow(row, child));
      case 'not': return !matchRow(row, filterExpr.child);
    }
  }

  return ids.filter((id) => {
    const row = rawById.get(id);
    if (!row) return false;
    return matchRow(row, expr);
  });
}

export function applySort<TItem, TId extends ItemId>(
  ids: TId[],
  rawById: Map<TId, TItem>,
  spec: SortSpec[],
  columns: Array<ColumnCoreDef<TItem>>
): TId[] {
  if (spec.length === 0) return ids;

  const colMap = new Map(columns.map((column) => [column.id, column]));

  return [...ids].sort((aId, bId) => {
    const aRow = rawById.get(aId)!;
    const bRow = rawById.get(bId)!;

    for (const { columnId, direction } of spec) {
      const col = colMap.get(columnId);
      if (!col) continue;

      const aValue = col.getValue(aRow, col.id, NO_CULTURE);
      const bValue = col.getValue(bRow, col.id, NO_CULTURE);

      let cmp = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        cmp = aValue - bValue;
      } else {
        cmp = String(aValue ?? '').localeCompare(String(bValue ?? ''));
      }

      if (cmp !== 0) {
        return direction === 'asc' ? cmp : -cmp;
      }
    }

    return 0;
  });
}

export function applySortFilter<TItem, TId extends ItemId>(
  orderedIds: TId[],
  rawById: Map<TId, TItem>,
  sortSpec: SortSpec[],
  filterExpr: FilterExpr | null,
  columns: Array<ColumnCoreDef<TItem>>
): TId[] {
  const filtered = applyFilter(orderedIds, rawById, filterExpr, columns);
  return applySort(filtered, rawById, sortSpec, columns);
}


