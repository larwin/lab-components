import React, {
  useRef, useCallback, useEffect, useMemo, useImperativeHandle,
} from 'react';
import { offsetTop, type ItemHeightPolicy, type VirtualLayoutState } from '@/core/collection/virtual';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { CollectionConfig } from '@/core/collection/shared/definition/types';
import type { CollectionIntent } from '@/core/collection/shared/intents/types';
import type { CollectionState } from '@/core/collection/shared/state/types';
import { buildPoolStructureKey } from '@/components/ui/collection/virtual/pool.invalidation';
import type { PoolCallbacks } from '@/components/ui/collection/virtual/PoolRenderer';
import { VirtualPool } from '@/components/ui/collection/virtual/VirtualPool';
import type { CollectionUiModel } from '@/components/ui/collection/shared/hooks/useCollectionModel';
import { LIST_DEFAULT_HEIGHT, LIST_OVERSCAN_DEFAULT } from '@/components/ui/collection/list/constants';
import '@/components/ui/collection/list/list.css';

export function resolvePoolItemHeight(policy: ItemHeightPolicy): number {
  if (policy.poolItemHeight != null) {
    return policy.poolItemHeight;
  }

  if (policy.kind === 'fixed') {
    return policy.itemHeight;
  }

  return policy.defaultHeight;
}

function scrollToIndex(
  container: HTMLDivElement,
  itemIndex: number,
  align: 'auto' | 'start' | 'end',
  fallbackItemHeight: number,
  layoutState: VirtualLayoutState
) {
  const targetTop = offsetTop(layoutState, itemIndex);
  const itemHeight = layoutState.heightsByIndex[itemIndex] ?? fallbackItemHeight;

  if (align === 'start') {
    container.scrollTop = targetTop;
    return;
  }

  if (align === 'end') {
    container.scrollTop = targetTop - container.clientHeight + itemHeight;
    return;
  }

  const itemBottom = targetTop + itemHeight;
  const viewTop = container.scrollTop;
  const viewBottom = container.scrollTop + container.clientHeight;

  if (targetTop < viewTop) {
    container.scrollTop = targetTop;
  } else if (itemBottom > viewBottom) {
    container.scrollTop = itemBottom - container.clientHeight;
  }
}

export interface CollectionViewportProps<TItem, TId extends ItemId = ItemId> {
  definition: CollectionConfig<TItem, TId>;
  listState: CollectionState<TId>;
  model: CollectionUiModel<TId>;
  dispatchIntent: (intent: CollectionIntent<TId>) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  isLoading?: boolean;
  height?: number;
  overscan?: number;
  context?: CollectionViewportContext;
  rowTone?: CollectionViewportRowTone;
  onCheckedChange?: (checkedIds: Set<TId>) => void;
}

export interface CollectionViewportHandle {
  focus: () => void;
  scrollToItem: (itemId: ItemId, align?: 'auto' | 'start' | 'end') => void;
  getVisibleItemRect: (visibleIndex: number) => DOMRect | null;
}

export type CollectionViewportContext = 'list' | 'grid' | 'menu';
export type CollectionViewportRowTone = 'default' | 'zebra';

function CollectionViewportInner<TItem, TId extends ItemId = ItemId>({
  definition,
  listState,
  model,
  dispatchIntent,
  handleKeyDown,
  isLoading = false,
  height = LIST_DEFAULT_HEIGHT,
  overscan = LIST_OVERSCAN_DEFAULT,
  context = 'list',
  rowTone = 'default',
  onCheckedChange,
}: CollectionViewportProps<TItem, TId>, ref: React.ForwardedRef<CollectionViewportHandle>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const a11yPrefixRef = useRef(`collection-${Math.random().toString(36).slice(2)}`);

  const {
    policy,
    fallbackItemHeight,
    activeCulture,
    store,
    derived,
    layoutState,
  } = model;

  const derivedRef = useRef(derived);
  derivedRef.current = derived;

  const layoutStateRef = useRef(layoutState);
  layoutStateRef.current = layoutState;

  const dispatchRef = useRef(dispatchIntent);
  dispatchRef.current = dispatchIntent;

  const poolItemHeight = useMemo(() => resolvePoolItemHeight(policy), [policy]);
  const poolStructureKey = useMemo(
    () => buildPoolStructureKey(policy, definition.kindMap),
    [policy, definition.kindMap]
  );

  const items = useMemo(() => Array.from(store.rawById.values()), [store]);

  const focusContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    try {
      container.focus({ preventScroll: true });
    } catch {
      container.focus();
    }
  }, []);

  useImperativeHandle(ref, () => ({
    focus: focusContainer,
    scrollToItem: (itemId: ItemId, align: 'auto' | 'start' | 'end' = 'auto') => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }
      const itemIndex = derivedRef.current.visibleItemIds.indexOf(itemId as TId);
      if (itemIndex < 0) {
        return;
      }
      scrollToIndex(
        container,
        itemIndex,
        align,
        fallbackItemHeight,
        layoutStateRef.current
      );
    },
    getVisibleItemRect: (visibleIndex: number) => {
      if (visibleIndex < 0) {
        return null;
      }
      const container = scrollContainerRef.current;
      if (!container) {
        return null;
      }
      const itemEl = container.querySelector<HTMLElement>(`[data-visible-index="${String(visibleIndex)}"]`);
      return itemEl?.getBoundingClientRect() ?? null;
    },
  }), [focusContainer, fallbackItemHeight]);

  const poolCallbacks = useMemo<PoolCallbacks>(() => ({
    onClickItem: (visibleIndex, modifiers) => {
      const itemId = derivedRef.current.visibleItemIds[visibleIndex];
      if (itemId == null) {
        return;
      }
      dispatchRef.current({
        type: 'CLICK_ITEM',
        itemId,
        modifiers,
      });
    },
    onActivateItem: (visibleIndex) => {
      const itemId = derivedRef.current.visibleItemIds[visibleIndex];
      if (itemId == null) {
        return;
      }
      const runtime = derivedRef.current.runtimeById.get(itemId);
      if (runtime?.isExpandable) {
        dispatchRef.current({
          type: 'TOGGLE_EXPAND_ITEM',
          itemId,
        });
      }

      dispatchRef.current({
        type: 'ACTIVATE_ITEM',
        itemId,
        source: 'mouse',
      });
    },
    onToggleCheckboxItem: (visibleIndex) => {
      const itemId = derivedRef.current.visibleItemIds[visibleIndex];
      if (itemId == null) {
        return;
      }
      dispatchRef.current({
        type: 'TOGGLE_CHECKBOX_ITEM',
        itemId,
      });
    },
  }), []);

  const hasTreeItems = useMemo(() => derived.visibleItemIds.some((itemId) => {
    const hierarchy = derived.runtimeById.get(itemId)?.hierarchy;
    return hierarchy?.parentId != null || hierarchy?.hasChildren === true;
  }), [derived.visibleItemIds, derived.runtimeById]);

  const containerRole = context === 'menu'
    ? 'menu'
    : (hasTreeItems ? 'tree' : 'listbox');

  const activeDescendantId = useMemo(() => {
    const focusedItemId = listState.focusedItemId;
    if (focusedItemId == null) {
      return null;
    }

    const visibleIndex = derived.visibleItemIds.indexOf(focusedItemId);
    if (visibleIndex < 0) {
      return null;
    }

    return `${a11yPrefixRef.current}-item-${visibleIndex}`;
  }, [derived.visibleItemIds, listState.focusedItemId]);

  useEffect(() => {
    onCheckedChange?.(new Set(listState.checkedItemIds));
  }, [listState.checkedItemIds, onCheckedChange]);

  return (
    <div
      ref={containerRef}
      role={containerRole}
      aria-activedescendant={activeDescendantId ?? undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="list-container"
      className={[
        'list-root',
        `is-context-${context}`,
        rowTone === 'zebra' ? 'is-row-tone-zebra' : '',
        'rounded-md border border-border bg-card text-card-foreground overflow-hidden outline-none',
      ].filter(Boolean).join(' ')}
    >
      <VirtualPool
        items={items}
        getItemId={definition.getItemId}
        derived={derived}
        listState={listState}
        layoutState={layoutState}
        kindMap={definition.kindMap}
        fallbackItemHeight={fallbackItemHeight}
        poolItemHeight={poolItemHeight}
        poolStructureKey={poolStructureKey}
        height={height}
        overscan={overscan}
        rowTone={rowTone}
        context={context}
        culture={activeCulture}
        callbacks={poolCallbacks}
        containerRef={scrollContainerRef}
        isLoading={isLoading}
        emptyContent="No items"
        loadingContent="Loading..."
        className="overflow-auto relative"
        a11yPrefix={a11yPrefixRef.current}
        manageHover
      />
    </div>
  );
}

const CollectionViewportForwardRef = React.forwardRef(CollectionViewportInner) as <
  TItem,
  TId extends ItemId = ItemId,
>(
  props: CollectionViewportProps<TItem, TId> & React.RefAttributes<CollectionViewportHandle>
) => React.ReactElement;

export const CollectionViewport = CollectionViewportForwardRef as <
  TItem,
  TId extends ItemId = ItemId,
>(
  props: CollectionViewportProps<TItem, TId> & React.RefAttributes<CollectionViewportHandle>
) => React.ReactElement;
