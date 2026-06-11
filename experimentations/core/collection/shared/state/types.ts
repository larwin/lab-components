import type { ItemId, ItemRuntime } from '../runtime';

export type { ItemId, PrimitiveValue, ItemRuntime } from '../runtime';
export type { SelectionMode, SelectionState } from '../selection';

export interface CollectionState<TId extends ItemId> {
  focusedItemId: TId | null;
  selectedItemIds: Set<TId>;
  checkedItemIds: Set<TId>;
  expandedItemIds: Set<TId>;
  disabledItemIds: Set<TId>;
}

export interface CollectionDerivedState<TId extends ItemId, TRuntime extends ItemRuntime> {
  visibleItemIds: TId[];
  runtimeById: Map<TId, TRuntime>;
}


