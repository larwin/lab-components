import type { ItemId } from '@/core/collection/shared/runtime';

export type SelectionMode = 'none' | 'single' | 'multi';
export const DEFAULT_SELECTION_MODE: SelectionMode = 'multi';

export interface SelectionState<TId extends ItemId> {
  selectedItemIds: Set<TId>;
  mode: SelectionMode;
}
