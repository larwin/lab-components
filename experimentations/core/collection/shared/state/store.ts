import type { ItemId } from '../runtime';

export interface CollectionDataStore<TItem, TId extends ItemId> {
  orderedIds: TId[];
  rawById: Map<TId, TItem>;
  parentById: Map<TId, TId | null>;
  childrenById: Map<TId, TId[]>;
}

export function buildCollectionStore<TItem, TId extends ItemId>(
  items: TItem[],
  getItemId: (item: TItem) => TId,
  getParentId?: (item: TItem) => TId | null | undefined
): CollectionDataStore<TItem, TId> {
  const rawById = new Map<TId, TItem>();
  const parentById = new Map<TId, TId | null>();
  const childrenById = new Map<TId, TId[]>();
  const orderedIds: TId[] = [];

  for (const item of items) {
    const itemId = getItemId(item);
    const parentId = getParentId?.(item) ?? null;

    if (rawById.has(itemId)) {
      throw new Error(`[Collection] Duplicate item id "${String(itemId)}" detected.`);
    }

    rawById.set(itemId, item);
    parentById.set(itemId, parentId);
    orderedIds.push(itemId);

    if (!childrenById.has(itemId)) {
      childrenById.set(itemId, []);
    }

    if (parentId != null) {
      if (!childrenById.has(parentId)) {
        childrenById.set(parentId, []);
      }
      childrenById.get(parentId)!.push(itemId);
    }
  }

  return {
    orderedIds,
    rawById,
    parentById,
    childrenById,
  };
}



