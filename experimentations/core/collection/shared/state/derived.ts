import type { Culture } from '@/core/culture';
import { FLAT_HIERARCHY, type HierarchyRuntime } from '@/core/collection/shared/hierarchy';
import type { CollectionCacheAdapter } from '@/core/collection/shared/cache/types';
import type { ItemId, ItemRuntime } from '../runtime';
import type { CollectionDerivedState, CollectionState } from './types';
import type { CollectionDataStore } from './store';

interface TreeFlattenResult<TId extends ItemId> {
  visibleItemIds: TId[];
  hierarchyById: Map<TId, HierarchyRuntime>;
}

function flattenTree<TItem, TId extends ItemId>(
  store: CollectionDataStore<TItem, TId>,
  expandedItemIds: Set<TId>
): TreeFlattenResult<TId> {
  const visibleItemIds: TId[] = [];
  const hierarchyById = new Map<TId, HierarchyRuntime>();

  const rootIds = store.orderedIds.filter((id) => {
    const parentId = store.parentById.get(id) ?? null;
    return parentId == null || !store.rawById.has(parentId);
  });

  const visit = (id: TId, depth: number, parentId: TId | null): void => {
    visibleItemIds.push(id);

    const childrenIds = store.childrenById.get(id) ?? [];
    hierarchyById.set(id, {
      depth,
      parentId,
      childrenIds,
      hasChildren: childrenIds.length > 0,
    });

    if (!expandedItemIds.has(id)) {
      return;
    }

    for (const childId of childrenIds) {
      visit(childId, depth + 1, id);
    }
  };

  for (const rootId of rootIds) {
    visit(rootId, 0, null);
  }

  return { visibleItemIds, hierarchyById };
}

function resolveItemKind<TItem, TId extends ItemId>(
  itemId: TId,
  item: TItem,
  cache: CollectionCacheAdapter<TId> | undefined,
  getItemKind: ((item: TItem, culture?: Culture) => string) | undefined,
  culture: Culture | undefined,
  defaultKind: string
): string {
  const cacheKindNamespace = '__list__';
  const cacheKindName = 'kind';

  if (cache?.hasValue(itemId, cacheKindNamespace, cacheKindName)) {
    return String(cache.getValue(itemId, cacheKindNamespace, cacheKindName));
  }

  const kind = getItemKind?.(item, culture) ?? defaultKind;
  cache?.setValue(itemId, cacheKindNamespace, cacheKindName, kind);

  return kind;
}

function collectChangedIds<TId extends ItemId>(
  prevState: CollectionState<TId>,
  nextState: CollectionState<TId>
): Set<TId> {
  const changedIds = new Set<TId>();

  if (prevState.focusedItemId != null) {
    changedIds.add(prevState.focusedItemId);
  }
  if (nextState.focusedItemId != null) {
    changedIds.add(nextState.focusedItemId);
  }

  for (const id of prevState.selectedItemIds) {
    if (!nextState.selectedItemIds.has(id)) {
      changedIds.add(id);
    }
  }
  for (const id of nextState.selectedItemIds) {
    if (!prevState.selectedItemIds.has(id)) {
      changedIds.add(id);
    }
  }

  return changedIds;
}

export function computeCollectionDerivedState<TItem, TId extends ItemId>(
  store: CollectionDataStore<TItem, TId>,
  state: CollectionState<TId>,
  options: {
    hasTree?: boolean;
    cache?: CollectionCacheAdapter<TId>;
    culture?: Culture;
    getItemKind?: (item: TItem, culture?: Culture) => string;
    defaultKind?: string;
    prevDerived?: CollectionDerivedState<TId, ItemRuntime>;
    prevState?: CollectionState<TId>;
  } = {}
): CollectionDerivedState<TId, ItemRuntime> {
  const {
    hasTree = false,
    cache,
    culture,
    getItemKind,
    defaultKind = 'default',
    prevDerived,
    prevState,
  } = options;

  const tree = hasTree
    ? flattenTree(store, state.expandedItemIds)
    : { visibleItemIds: store.orderedIds, hierarchyById: new Map<TId, HierarchyRuntime>() };

  const canPatchFlatRuntime =
    !hasTree
    && prevDerived != null
    && prevState != null
    && prevDerived.visibleItemIds === store.orderedIds
    && prevState.checkedItemIds === state.checkedItemIds
    && prevState.disabledItemIds === state.disabledItemIds
    && prevState.expandedItemIds === state.expandedItemIds;

  if (canPatchFlatRuntime) {
    const changedIds = collectChangedIds(prevState, state);
    if (changedIds.size === 0) {
      return prevDerived;
    }

    const runtimeById = new Map(prevDerived.runtimeById);

    for (const itemId of changedIds) {
      const previous = runtimeById.get(itemId);
      if (!previous) {
        continue;
      }

      runtimeById.set(itemId, {
        ...previous,
        isFocused: state.focusedItemId === itemId,
        isSelected: state.selectedItemIds.has(itemId),
      });
    }

    return {
      visibleItemIds: tree.visibleItemIds,
      runtimeById,
    };
  }

  const runtimeById = new Map<TId, ItemRuntime>();

  for (const itemId of tree.visibleItemIds) {
    const item = store.rawById.get(itemId);
    if (!item) {
      continue;
    }

    const childrenIds = store.childrenById.get(itemId) ?? [];
    const hierarchy = tree.hierarchyById.get(itemId) ?? FLAT_HIERARCHY;
    const kind = resolveItemKind(itemId, item, cache, getItemKind, culture, defaultKind);

    runtimeById.set(itemId, {
      kind,
      isFocused: state.focusedItemId === itemId,
      isSelected: state.selectedItemIds.has(itemId),
      isChecked: state.checkedItemIds.has(itemId),
      isDisabled: state.disabledItemIds.has(itemId),
      isExpanded: state.expandedItemIds.has(itemId),
      isExpandable: childrenIds.length > 0,
      isVisible: true,
      hierarchy,
    });
  }

  return {
    visibleItemIds: tree.visibleItemIds,
    runtimeById,
  };
}



