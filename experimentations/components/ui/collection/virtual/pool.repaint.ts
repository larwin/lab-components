import type { Culture } from '@/core/culture';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { VirtualLayoutState } from '@/core/collection/virtual';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { CollectionDerivedState, CollectionState } from '@/core/collection/shared/state';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import { computeDescriptorWithInheritance } from '@/core/collection/shared/kind/inheritance';
import { updatePooledItem, type PooledItem } from './PoolRenderer';
import { computePoolWindowPlan } from './pool.window';

interface RepaintPoolOptions<TItem, TId extends ItemId> {
  pool: PooledItem[];
  spacerEl: HTMLDivElement;
  poolContainerEl: HTMLDivElement;
  derived: CollectionDerivedState<TId, ItemRuntime>;
  listState: CollectionState<TId>;
  layoutState: VirtualLayoutState;
  fallbackItemHeight: number;
  scrollTop: number;
  containerHeight: number;
  overscan: number;
  rowTone: 'default' | 'zebra';
  context: 'list' | 'grid' | 'menu';
  kindMap: Record<string, AnyRowKindDefinition<TItem, TId>>;
  itemsById: Map<TId, TItem>;
  runtimeById: Map<TId, ItemRuntime>;
  culture?: Culture;
  hoveredItemId?: TId | null;
}

function resetHiddenPooledItem(item: PooledItem) {
  item.el.style.cssText = 'display: none;';
  item.el.removeAttribute('id');
  item.el.removeAttribute('role');
  item.el.removeAttribute('aria-selected');
  item.el.removeAttribute('aria-expanded');
  item.el.removeAttribute('aria-checked');
  item.el.className = 'list-pooled-item';
  item.el.dataset.visibleIndex = '';
  item.lastJsx = null;
  item.pendingJsx = null;
  item.lastItemId = null;
  item.lastItemRef = undefined;
  item.appliedStyleKeys = [];
}

export function repaintPool<TItem, TId extends ItemId>({
  pool,
  spacerEl,
  poolContainerEl,
  derived,
  listState,
  layoutState,
  fallbackItemHeight,
  scrollTop,
  containerHeight,
  overscan,
  rowTone,
  context,
  kindMap,
  itemsById,
  runtimeById,
  culture,
  hoveredItemId,
}: RepaintPoolOptions<TItem, TId>) {
  const plan = computePoolWindowPlan({
    poolSize: pool.length,
    derived,
    listState,
    layoutState,
    fallbackItemHeight,
    scrollTop,
    containerHeight,
    overscan,
  });

  spacerEl.style.height = `${plan.totalHeight}px`;
  poolContainerEl.style.transform = `translate3d(0, ${plan.offsetTop}px, 0)`;

  for (const hiddenSlot of plan.hiddenSlots) {
    resetHiddenPooledItem(pool[hiddenSlot.poolIndex]);
  }

  for (const visibleSlot of plan.visibleSlots) {
    const item = itemsById.get(visibleSlot.itemId);
    const runtime = runtimeById.get(visibleSlot.itemId);

    if (!item || !runtime) {
      resetHiddenPooledItem(pool[visibleSlot.poolIndex]);
      continue;
    }

    const descriptor = computeDescriptorWithInheritance(
      kindMap,
      visibleSlot.kind,
      item,
      visibleSlot.itemId,
      runtime,
      culture
    );

    updatePooledItem(
      pool[visibleSlot.poolIndex],
      visibleSlot.itemId,
      visibleSlot.visibleIndex,
      visibleSlot.kind,
      descriptor,
      visibleSlot.height,
      kindMap,
      item
    );
    const pooledEl = pool[visibleSlot.poolIndex].el;
    const a11yPrefix = poolContainerEl.dataset.a11yPrefix ?? 'collection';
    const isTreeItem = context !== 'menu'
      && (runtime.hierarchy.parentId != null || runtime.hierarchy.hasChildren);
    const role = context === 'menu'
      ? (visibleSlot.kind === 'separator'
        ? 'separator'
        : (visibleSlot.kind === 'checkbox' ? 'menuitemcheckbox' : 'menuitem'))
      : (isTreeItem ? 'treeitem' : 'option');

    pooledEl.id = `${a11yPrefix}-item-${visibleSlot.visibleIndex}`;
    pooledEl.setAttribute('role', role);
    if (role === 'option' || role === 'treeitem') {
      pooledEl.setAttribute('aria-selected', String(runtime.isSelected));
    } else {
      pooledEl.removeAttribute('aria-selected');
    }

    if (role === 'treeitem' && runtime.isExpandable) {
      pooledEl.setAttribute('aria-expanded', String(runtime.isExpanded));
    } else {
      pooledEl.removeAttribute('aria-expanded');
    }

    if (role === 'menuitemcheckbox') {
      pooledEl.setAttribute('aria-checked', String(runtime.isChecked));
    } else {
      pooledEl.removeAttribute('aria-checked');
    }

    if (rowTone === 'zebra' && visibleSlot.visibleIndex % 2 === 1) {
      pooledEl.classList.add('is-zebra-alt');
    } else {
      pooledEl.classList.remove('is-zebra-alt');
    }
    if (hoveredItemId != null && visibleSlot.itemId === hoveredItemId) {
      pooledEl.classList.add('is-hovered');
    } else {
      pooledEl.classList.remove('is-hovered');
    }
    pooledEl.style.display = '';
  }
}





