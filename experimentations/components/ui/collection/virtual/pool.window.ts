import { computeVirtualWindow, type VirtualLayoutState } from '@/core/collection/virtual';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { CollectionDerivedState, CollectionState } from '@/core/collection/shared/state';
import type { ItemRuntime } from '@/core/collection/shared/runtime';

export interface VisiblePoolSlot<TId extends ItemId = ItemId> {
  poolIndex: number;
  visibleIndex: number;
  itemId: TId;
  kind: string;
  height: number;
  isSelected: boolean;
  isFocused: boolean;
}

export interface HiddenPoolSlot {
  poolIndex: number;
}

export interface PoolWindowPlan<TId extends ItemId = ItemId> {
  totalHeight: number;
  offsetTop: number;
  visibleSlots: VisiblePoolSlot<TId>[];
  hiddenSlots: HiddenPoolSlot[];
}

interface ComputePoolWindowPlanOptions<TId extends ItemId = ItemId> {
  poolSize: number;
  derived: CollectionDerivedState<TId, ItemRuntime>;
  listState: CollectionState<TId>;
  layoutState: VirtualLayoutState;
  fallbackItemHeight: number;
  scrollTop: number;
  containerHeight: number;
  overscan: number;
}

export function computePoolWindowPlan<TId extends ItemId>({
  poolSize,
  derived,
  listState,
  layoutState,
  fallbackItemHeight,
  scrollTop,
  containerHeight,
  overscan,
}: ComputePoolWindowPlanOptions<TId>): PoolWindowPlan<TId> {
  const virtualWindow = computeVirtualWindow(
    derived.visibleItemIds.length,
    scrollTop,
    containerHeight,
    layoutState,
    overscan
  );

  const visibleSlots: VisiblePoolSlot<TId>[] = [];
  const hiddenSlots: HiddenPoolSlot[] = [];
  const visibleCount =
    virtualWindow.endIndex >= virtualWindow.startIndex
      ? virtualWindow.endIndex - virtualWindow.startIndex + 1
      : 0;

  for (let poolIndex = 0; poolIndex < poolSize; poolIndex++) {
    if (poolIndex >= visibleCount) {
      hiddenSlots.push({ poolIndex });
      continue;
    }

    const visibleIndex = virtualWindow.startIndex + poolIndex;
    const itemId = derived.visibleItemIds[visibleIndex];
    const runtime = derived.runtimeById.get(itemId);

    if (!runtime) {
      hiddenSlots.push({ poolIndex });
      continue;
    }

    visibleSlots.push({
      poolIndex,
      visibleIndex,
      itemId,
      kind: runtime.kind,
      height: layoutState.heightsByIndex[visibleIndex] ?? fallbackItemHeight,
      isSelected: listState.selectedItemIds.has(itemId),
      isFocused: listState.focusedItemId === itemId,
    });
  }

  return {
    totalHeight: virtualWindow.totalHeight,
    offsetTop: virtualWindow.offsetTop,
    visibleSlots,
    hiddenSlots,
  };
}




