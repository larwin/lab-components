import type { Culture } from '@/core/culture';

export interface ColumnCoreDef<TItem> {
  id: string;
  kind: string;
  getValue: (row: TItem, colId: string, culture: Culture) => unknown;
  sortable?: boolean;
  filterable?: boolean;
  filterOperators?: string[];
}


