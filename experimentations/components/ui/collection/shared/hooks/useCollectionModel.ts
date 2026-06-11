import { useEffect, useMemo, useRef } from 'react';
import type { Culture } from '@/core/culture';
import type { CollectionCacheAdapter } from '@/core/collection/shared/cache/types';
import type { CollectionConfig, AnyRowKindDefinition } from '@/core/collection/shared/definition/types';
import type { ItemId, ItemRuntime } from '@/core/collection/shared/runtime';
import { computeCollectionDerivedState } from '@/core/collection/shared/state/derived';
import { buildCollectionStore } from '@/core/collection/shared/state/store';
import type { CollectionDerivedState, CollectionState } from '@/core/collection/shared/state/types';
import { computeLayoutState, type ItemHeightPolicy, type VirtualLayoutState } from '@/core/collection/virtual';

export type CollectionModelCache<TId extends ItemId> = CollectionCacheAdapter<TId> & {
  invalidateAll: () => void;
};

export interface CollectionUiModel<TId extends ItemId> {
  policy: ItemHeightPolicy;
  fallbackItemHeight: number;
  activeCulture: Culture | undefined;
  store: ReturnType<typeof buildCollectionStore<any, TId>>;
  derived: CollectionDerivedState<TId, ItemRuntime>;
  layoutState: VirtualLayoutState;
}

interface UseCollectionModelOptions<TItem, TId extends ItemId> {
  items: TItem[];
  definition: CollectionConfig<TItem, TId>;
  collectionState?: CollectionState<TId>;
  listState?: CollectionState<TId>;
  cache: CollectionModelCache<TId>;
  itemHeightPolicy?: ItemHeightPolicy;
  culture?: Culture;
}

function buildDefaultPolicy<TItem, TId extends ItemId>(
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>
): ItemHeightPolicy {
  const heights = Object.fromEntries(
    Object.entries(kindMap).map(([kind, kindDef]) => [kind, kindDef.height])
  );
  const heightValues = Object.values(heights);
  const defaultHeight = kindMap.default?.height ?? (heightValues.length > 0 ? Math.min(...heightValues) : 1);

  return {
    kind: 'byKind',
    heights,
    defaultHeight,
  };
}

function fallbackHeightFromPolicy(policy: ItemHeightPolicy): number {
  if (policy.kind === 'fixed') {
    return policy.itemHeight;
  }

  return policy.defaultHeight;
}

export function useCollectionModel<TItem, TId extends ItemId>({
  items,
  definition,
  collectionState,
  listState,
  cache,
  itemHeightPolicy,
  culture,
}: UseCollectionModelOptions<TItem, TId>): CollectionUiModel<TId> {
  const effectiveCollectionState = collectionState ?? listState;
  if (!effectiveCollectionState) {
    throw new Error('useCollectionModel requires `collectionState` (or legacy `listState`).');
  }

  const policy = useMemo(
    () => itemHeightPolicy ?? buildDefaultPolicy(definition.kindMap),
    [itemHeightPolicy, definition.kindMap]
  );
  const fallbackItemHeight = fallbackHeightFromPolicy(policy);
  const activeCulture = culture ?? definition.culture;

  const store = useMemo(
    () => buildCollectionStore(items, definition.getItemId, definition.hierarchy?.getParentId),
    [items, definition.getItemId, definition.hierarchy]
  );

  const prevCacheInputsRef = useRef({
    store,
    culture: activeCulture,
    getItemKind: definition.getItemKind,
    defaultKind: definition.defaultKind,
  });

  useEffect(() => {
    const prev = prevCacheInputsRef.current;
    const shouldInvalidateCache =
      prev.store !== store
      || prev.culture !== activeCulture
      || prev.getItemKind !== definition.getItemKind
      || prev.defaultKind !== definition.defaultKind;

    if (shouldInvalidateCache) {
      cache.invalidateAll();
      prevCacheInputsRef.current = {
        store,
        culture: activeCulture,
        getItemKind: definition.getItemKind,
        defaultKind: definition.defaultKind,
      };
    }
  }, [cache, store, activeCulture, definition.getItemKind, definition.defaultKind]);

  const prevDerivedRef = useRef<{
    store: typeof store;
    state: CollectionState<TId>;
    derived: CollectionDerivedState<TId, ItemRuntime>;
    hasTree: boolean;
    culture: Culture | undefined;
    getItemKind: typeof definition.getItemKind;
    defaultKind: string;
  } | null>(null);

  const hasTree = Boolean(definition.hierarchy);

  const derived = useMemo(
    () => {
      const prev = prevDerivedRef.current;
      const canReusePrev =
        prev != null
        && prev.store === store
        && prev.hasTree === hasTree
        && prev.culture === activeCulture
        && prev.getItemKind === definition.getItemKind
        && prev.defaultKind === definition.defaultKind;

      const next = computeCollectionDerivedState(store, effectiveCollectionState, {
        hasTree,
        cache,
        culture: activeCulture,
        getItemKind: definition.getItemKind,
        defaultKind: definition.defaultKind,
        prevDerived: canReusePrev ? prev.derived : undefined,
        prevState: canReusePrev ? prev.state : undefined,
      });

      return next;
    },
    [
      store,
      effectiveCollectionState,
      definition.hierarchy,
      definition.getItemKind,
      definition.defaultKind,
      activeCulture,
      cache,
    ]
  );

  useEffect(() => {
    prevDerivedRef.current = {
      store,
      state: effectiveCollectionState,
      derived,
      hasTree,
      culture: activeCulture,
      getItemKind: definition.getItemKind,
      defaultKind: definition.defaultKind,
    };
  }, [
    store,
    effectiveCollectionState,
    derived,
    hasTree,
    activeCulture,
    definition.getItemKind,
    definition.defaultKind,
  ]);

  const itemKinds = useMemo(
    () => (policy.kind === 'fixed'
      ? []
      : derived.visibleItemIds.map((itemId) => derived.runtimeById.get(itemId)?.kind ?? definition.defaultKind)),
    [policy.kind, derived.visibleItemIds, derived.runtimeById, definition.defaultKind]
  );

  const layoutState = useMemo(
    () => (policy.kind === 'fixed'
      ? computeLayoutState([], policy, derived.visibleItemIds.length)
      : computeLayoutState(itemKinds, policy)),
    [policy, itemKinds, derived.visibleItemIds.length]
  );

  return {
    policy,
    fallbackItemHeight,
    activeCulture,
    store,
    derived,
    layoutState,
  };
}
