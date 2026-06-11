import type { ItemId } from '../runtime';
import type { CollectionState } from './types';

export function createInitialCollectionState<TId extends ItemId>(): CollectionState<TId> {
  return {
    focusedItemId: null,
    selectedItemIds: new Set<TId>(),
    checkedItemIds: new Set<TId>(),
    expandedItemIds: new Set<TId>(),
    disabledItemIds: new Set<TId>(),
  };
}


