export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  columnId: string;
  direction: SortDirection;
}

export type FilterOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'in' | 'notIn';

export type FilterExpr =
  | { kind: 'leaf'; columnId: string; op: FilterOp; value: unknown }
  | { kind: 'and'; children: FilterExpr[] }
  | { kind: 'or'; children: FilterExpr[] }
  | { kind: 'not'; child: FilterExpr };


