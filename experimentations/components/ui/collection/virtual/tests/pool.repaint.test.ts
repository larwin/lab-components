import { describe, expect, it, vi } from 'vitest';
import type { VirtualLayoutState } from '@/core/collection/virtual';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { CollectionDerivedState, CollectionState } from '@/core/collection/shared/state';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import { createItemPool } from '../PoolRenderer';
import { repaintPool } from '../pool.repaint';

interface TestItem {
  id: string;
  label: string;
}

interface TestDOMRefs {
  labelEl: HTMLSpanElement;
}

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

function createTextKind(kind = 'text'): AnyRowKindDefinition<TestItem, string> {
  return {
    kind,
    height: 20,
    computeDescriptor(item, _id, runtime) {
      return {
        label: item.label,
        className: runtime.isSelected ? 'selected' : 'normal',
      };
    },
    create(container) {
      const labelEl = document.createElement('span');
      labelEl.className = 'label';
      container.appendChild(labelEl);
      return { labelEl };
    },
    update(refs: TestDOMRefs, descriptor: { label?: string; className?: string }) {
      refs.labelEl.textContent = descriptor.label ?? '';
      refs.labelEl.className = descriptor.className ?? 'label';
    },
  };
}

describe('repaintPool', () => {
  it('repaints pooled items on scroll and updates offsets', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const itemsById = new Map(ids.map((id) => [id, { id, label: id }]));
    const derived: CollectionDerivedState<string, ItemRuntime> = {
      visibleItemIds: ids,
      runtimeById: new Map(ids.map((id) => [id, createRuntime()])),
    };
    const layoutState: VirtualLayoutState = {
      heightsByIndex: [20, 20, 20, 20],
      prefixSums: [0, 20, 40, 60, 80],
      totalHeight: 80,
    };
    const kindMap = { default: createTextKind(), text: createTextKind() };
    const poolContainer = document.createElement('div');
    const spacerEl = document.createElement('div');
    const pool = createItemPool<TestItem, string>(poolContainer, 3, kindMap, {});

    repaintPool({
      pool,
      spacerEl,
      poolContainerEl: poolContainer,
      derived,
      listState: createState(),
      layoutState,
      fallbackItemHeight: 20,
      scrollTop: 0,
      containerHeight: 40,
      overscan: 0,
      rowTone: 'default',
      context: 'list',
      kindMap,
      itemsById,
      runtimeById: derived.runtimeById,
    });

    expect(spacerEl.style.height).toBe('80px');
    expect(poolContainer.style.transform).toBe('translate3d(0, 0px, 0)');
    expect(pool[0].el.dataset.visibleIndex).toBe('0');
    expect(pool[0].el.textContent).toBe('a');
    expect(pool[2].el.style.display).toBe('');

    repaintPool({
      pool,
      spacerEl,
      poolContainerEl: poolContainer,
      derived,
      listState: createState(),
      layoutState,
      fallbackItemHeight: 20,
      scrollTop: 20,
      containerHeight: 40,
      overscan: 0,
      rowTone: 'default',
      context: 'list',
      kindMap,
      itemsById,
      runtimeById: derived.runtimeById,
    });

    expect(poolContainer.style.transform).toBe('translate3d(0, 20px, 0)');
    expect(pool[0].el.dataset.visibleIndex).toBe('1');
    expect(pool[0].el.textContent).toBe('b');
    expect(pool[1].el.dataset.visibleIndex).toBe('2');
  });

  it('repaints when descriptor changes (state change path)', () => {
    const ids = ['a'];
    const itemsById = new Map<string, TestItem>([['a', { id: 'a', label: 'alpha' }]]);
    const derived: CollectionDerivedState<string, ItemRuntime> = {
      visibleItemIds: ids,
      runtimeById: new Map(ids.map((id) => [id, createRuntime()])),
    };
    const layoutState: VirtualLayoutState = {
      heightsByIndex: [20],
      prefixSums: [0, 20],
      totalHeight: 20,
    };
    const kindMap = { default: createTextKind(), text: createTextKind() };
    const poolContainer = document.createElement('div');
    const spacerEl = document.createElement('div');
    const pool = createItemPool<TestItem, string>(poolContainer, 1, kindMap, {});

    repaintPool({
      pool,
      spacerEl,
      poolContainerEl: poolContainer,
      derived,
      listState: createState(),
      layoutState,
      fallbackItemHeight: 20,
      scrollTop: 0,
      containerHeight: 40,
      overscan: 0,
      rowTone: 'default',
      context: 'list',
      kindMap,
      itemsById,
      runtimeById: derived.runtimeById,
    });
    expect(pool[0].el.querySelector('span')?.className).toBe('normal');

    const selectedRuntime: CollectionDerivedState<string, ItemRuntime> = {
      ...derived,
      runtimeById: new Map([['a', createRuntime()]]),
    };
    selectedRuntime.runtimeById.get('a')!.isSelected = true;

    repaintPool({
      pool,
      spacerEl,
      poolContainerEl: poolContainer,
      derived: selectedRuntime,
      listState: createState({
        selectedItemIds: new Set(['a']),
      }),
      layoutState,
      fallbackItemHeight: 20,
      scrollTop: 0,
      containerHeight: 40,
      overscan: 0,
      rowTone: 'default',
      context: 'list',
      kindMap,
      itemsById,
      runtimeById: selectedRuntime.runtimeById,
    });

    expect(pool[0].el.querySelector('.selected')).toBeTruthy();
  });

  it('computes descriptors only for visible slots', () => {
    const ids = Array.from({ length: 100 }, (_, index) => `id-${index}`);
    const itemsById = new Map(ids.map((id) => [id, { id, label: id }]));
    const computeDescriptor = vi.fn((item: TestItem) => ({ label: item.label }));
    const kindMap: Record<string, AnyRowKindDefinition<TestItem, string>> = {
      default: {
        kind: 'text',
        height: 20,
        computeDescriptor,
        create(container) {
          const labelEl = document.createElement('span');
          container.appendChild(labelEl);
          return { labelEl };
        },
        update(refs: TestDOMRefs, descriptor: { label?: string }) {
          refs.labelEl.textContent = descriptor.label ?? '';
        },
      },
      text: {
        kind: 'text',
        height: 20,
        computeDescriptor,
        create(container) {
          const labelEl = document.createElement('span');
          container.appendChild(labelEl);
          return { labelEl };
        },
        update(refs: TestDOMRefs, descriptor: { label?: string }) {
          refs.labelEl.textContent = descriptor.label ?? '';
        },
      },
    };
    const derived: CollectionDerivedState<string, ItemRuntime> = {
      visibleItemIds: ids,
      runtimeById: new Map(ids.map((id) => [id, createRuntime()])),
    };
    const layoutState: VirtualLayoutState = {
      heightsByIndex: [],
      prefixSums: [0],
      totalHeight: ids.length * 20,
      uniformHeight: 20,
    };
    const poolContainer = document.createElement('div');
    const spacerEl = document.createElement('div');
    const pool = createItemPool<TestItem, string>(poolContainer, 5, kindMap, {});

    repaintPool({
      pool,
      spacerEl,
      poolContainerEl: poolContainer,
      derived,
      listState: createState(),
      layoutState,
      fallbackItemHeight: 20,
      scrollTop: 0,
      containerHeight: 40,
      overscan: 0,
      rowTone: 'default',
      context: 'list',
      kindMap,
      itemsById,
      runtimeById: derived.runtimeById,
    });

    expect(computeDescriptor).toHaveBeenCalledTimes(3);
  });

  it('resets pooled row inline style when slot is recycled', () => {
    const ids = ['a', 'b'];
    const itemsById = new Map(ids.map((id) => [id, { id, label: id }]));
    const derived: CollectionDerivedState<string, ItemRuntime> = {
      visibleItemIds: ids,
      runtimeById: new Map(ids.map((id) => [id, createRuntime()])),
    };
    const layoutState: VirtualLayoutState = {
      heightsByIndex: [20, 20],
      prefixSums: [0, 20, 40],
      totalHeight: 40,
    };
    const kindMap: Record<string, AnyRowKindDefinition<TestItem, string>> = {
      default: {
        kind: 'text',
        height: 20,
        computeDescriptor(item) {
          return item.id === 'a'
            ? { label: item.label, style: { color: 'red' } }
            : { label: item.label };
        },
        create(container) {
          const labelEl = document.createElement('span');
          container.appendChild(labelEl);
          return { labelEl };
        },
        update(refs: TestDOMRefs, descriptor: { label?: string }) {
          refs.labelEl.textContent = descriptor.label ?? '';
        },
      },
      text: {
        kind: 'text',
        height: 20,
        computeDescriptor(item) {
          return item.id === 'a'
            ? { label: item.label, style: { color: 'red' } }
            : { label: item.label };
        },
        create(container) {
          const labelEl = document.createElement('span');
          container.appendChild(labelEl);
          return { labelEl };
        },
        update(refs: TestDOMRefs, descriptor: { label?: string }) {
          refs.labelEl.textContent = descriptor.label ?? '';
        },
      },
    };
    const poolContainer = document.createElement('div');
    const spacerEl = document.createElement('div');
    const pool = createItemPool<TestItem, string>(poolContainer, 1, kindMap, {});

    repaintPool({
      pool,
      spacerEl,
      poolContainerEl: poolContainer,
      derived,
      listState: createState(),
      layoutState,
      fallbackItemHeight: 20,
      scrollTop: 0,
      containerHeight: 20,
      overscan: 0,
      rowTone: 'default',
      context: 'list',
      kindMap,
      itemsById,
      runtimeById: derived.runtimeById,
    });

    expect(pool[0].el.dataset.visibleIndex).toBe('0');
    expect(pool[0].el.style.color).toBe('red');

    repaintPool({
      pool,
      spacerEl,
      poolContainerEl: poolContainer,
      derived,
      listState: createState(),
      layoutState,
      fallbackItemHeight: 20,
      scrollTop: 20,
      containerHeight: 20,
      overscan: 0,
      rowTone: 'default',
      context: 'list',
      kindMap,
      itemsById,
      runtimeById: derived.runtimeById,
    });

    expect(pool[0].el.dataset.visibleIndex).toBe('1');
    expect(pool[0].el.style.color).toBe('');
  });
});




