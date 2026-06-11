import type { ItemId } from '../runtime';

export interface CollectionCacheAdapter<TId extends ItemId> {
  hasValue(itemId: TId, kind: string, name: string): boolean;
  getValue(itemId: TId, kind: string, name: string): unknown;
  setValue(itemId: TId, kind: string, name: string, value: unknown): void;
}
