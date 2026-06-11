import type { FilterExpr, SortSpec } from '../state/types';
import type { CollectionIntent } from '@/core/collection/shared/intents';
import type { ItemId } from '@/core/collection/shared/runtime';

export type GridIntent<TId extends ItemId = ItemId> =
  | CollectionIntent<TId>
  | { type: 'SET_SORT'; spec: SortSpec[] }
  | { type: 'SET_FILTER'; expr: FilterExpr | null }
  | { type: 'REORDER_COLUMNS'; draggedKeys: string[]; insertIndex: number }
  | { type: 'RESIZE_COLUMN'; columnId: string; width: number }
  | { type: 'EXECUTE_ROW_ACTION'; itemId: TId; actionId: string };




