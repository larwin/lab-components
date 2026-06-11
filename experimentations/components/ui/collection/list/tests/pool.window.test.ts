import { describe, expect, it } from 'vitest';
import type { VirtualLayoutState } from '@/core/collection/virtual';
import type { CollectionState, ItemRuntime, CollectionDerivedState } from '@/core/collection/shared/state/types';
import { computePoolWindowPlan } from '@/components/ui/collection/virtual/pool.window';

function createRuntime(kind = 'text'): ItemRuntime {
  return {
    kind,
    isFocused: false,
    isSelected: false,
    isChecked: false,
    isDisabled: false,
    isExpanded: false,
    isExpandable: false,
    isVisible: true,
    hierarchy: {
      depth: 0,
      parentId: null,
      childrenIds: [],
      hasChildren: false,
    },
  };
}

function createState(overrides: Partial<CollectionState<string>> = {}): CollectionState<string> {
  return {
    focusedItemId: null,
    selectedItemIds: new Set<string>(),
    checkedItemIds: new Set<string>(),
    expandedItemIds: new Set<string>(),
    disabledItemIds: new Set<string>(),
    ...overrides,
  };
}

describe('computePoolWindowPlan', () => {
  it('returns an empty window for 0 items', () => {
    const derived: CollectionDerivedState<string, ItemRuntime> = {
      visibleItemIds: [],
      runtimeById: new Map(),
    };
    const layoutState: VirtualLayoutState = {
      heightsByIndex: [],
      prefixSums: [0],
      totalHeight: 0,
    };

    const plan = computePoolWindowPlan({
      poolSize: 3,
      derived,
      listState: createState(),
      layoutState,
      fallbackItemHeight: 30,
      scrollTop: 0,
      containerHeight: 100,
      overscan: 2,
    });

    expect(plan.totalHeight).toBe(0);
    expect(plan.offsetTop).toBe(0);
    expect(plan.visibleSlots).toEqual([]);
    expect(plan.hiddenSlots).toEqual([{ poolIndex: 0 }, { poolIndex: 1 }, { poolIndex: 2 }]);
  });

  it('computes visible and hidden pool slots with correct offsets', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const derived: CollectionDerivedState<string, ItemRuntime> = {
      visibleItemIds: ids,
      runtimeById: new Map(ids.map((id) => [id, createRuntime('text')])),
    };
    const layoutState: VirtualLayoutState = {
      heightsByIndex: [20, 20, 20, 20, 20],
      prefixSums: [0, 20, 40, 60, 80, 100],
      totalHeight: 100,
    };

    const plan = computePoolWindowPlan({
      poolSize: 4,
      derived,
      listState: createState({
        selectedItemIds: new Set(['c']),
        focusedItemId: 'd',
      }),
      layoutState,
      fallbackItemHeight: 20,
      scrollTop: 40,
      containerHeight: 40,
      overscan: 0,
    });

    expect(plan.totalHeight).toBe(100);
    expect(plan.offsetTop).toBe(40);
    expect(plan.visibleSlots.map((slot) => slot.itemId)).toEqual(['c', 'd', 'e']);
    expect(plan.visibleSlots[0]).toMatchObject({
      poolIndex: 0,
      visibleIndex: 2,
      isSelected: true,
      isFocused: false,
    });
    expect(plan.visibleSlots[1]).toMatchObject({
      poolIndex: 1,
      visibleIndex: 3,
      isSelected: false,
      isFocused: true,
    });
    expect(plan.hiddenSlots).toEqual([{ poolIndex: 3 }]);
  });

  it('hides slots when runtime is missing', () => {
    const ids = ['a', 'b'];
    const derived: CollectionDerivedState<string, ItemRuntime> = {
      visibleItemIds: ids,
      runtimeById: new Map([
        ['a', createRuntime('text')],
      ]),
    };
    const layoutState: VirtualLayoutState = {
      heightsByIndex: [24, 24],
      prefixSums: [0, 24, 48],
      totalHeight: 48,
    };
    const plan = computePoolWindowPlan({
      poolSize: 2,
      derived,
      listState: createState(),
      layoutState,
      fallbackItemHeight: 24,
      scrollTop: 0,
      containerHeight: 48,
      overscan: 0,
    });

    expect(plan.visibleSlots.map((slot) => slot.itemId)).toEqual(['a']);
    expect(plan.hiddenSlots).toEqual([{ poolIndex: 1 }]);
  });
});







