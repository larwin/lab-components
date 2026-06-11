import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { computeLayoutState, type VirtualLayoutState } from '@/core/collection/virtual';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { CollectionDerivedState, CollectionState } from '@/core/collection/shared/state';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import { VirtualPool } from '../VirtualPool';

interface Item {
  id: string;
  label: string;
}

interface TextDescriptor {
  label: string;
}

interface TextRefs {
  rootEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
}

function createRuntime(kind: string): ItemRuntime {
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

function createKind(): AnyRowKindDefinition<Item, string> {
  return {
    kind: 'text',
    height: 32,
    computeDescriptor(item) {
      return { label: item.label };
    },
    create(container) {
      const rootEl = document.createElement('div');
      const labelEl = document.createElement('span');
      rootEl.appendChild(labelEl);
      container.appendChild(rootEl);
      return { rootEl, labelEl } as TextRefs;
    },
    update(refs: TextRefs, descriptor: TextDescriptor) {
      refs.labelEl.textContent = descriptor.label;
    },
  };
}

function createState(): CollectionState<string> {
  return {
    focusedItemId: null,
    selectedItemIds: new Set<string>(),
    checkedItemIds: new Set<string>(),
    expandedItemIds: new Set<string>(),
    disabledItemIds: new Set<string>(),
  };
}

function createDerived(items: Item[]): CollectionDerivedState<string, ItemRuntime> {
  const runtimeById = new Map<string, ItemRuntime>();
  for (const item of items) {
    runtimeById.set(item.id, createRuntime('text'));
  }
  return {
    visibleItemIds: items.map((item) => item.id),
    runtimeById,
  };
}

function createLayout(itemsCount: number): VirtualLayoutState {
  return computeLayoutState([], { kind: 'fixed', itemHeight: 32 }, itemsCount);
}

describe('VirtualPool', () => {
  it('renders items and forwards scrollTop to onScroll', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: String(i), label: `Item ${i}` }));
    const kind = createKind();
    const onScroll = vi.fn();

    render(
      <VirtualPool
        items={items}
        getItemId={(item) => item.id}
        derived={createDerived(items)}
        listState={createState()}
        layoutState={createLayout(items.length)}
        kindMap={{ default: kind, text: kind }}
        fallbackItemHeight={32}
        poolItemHeight={32}
        poolStructureKey="fixed-32"
        height={96}
        overscan={0}
        onScroll={onScroll}
      />
    );

    expect(await screen.findByText('Item 0')).toBeInTheDocument();

    const scrollEl = screen.getByTestId('virtual-pool-scroll');
    scrollEl.scrollTop = 64;
    fireEvent.scroll(scrollEl);

    await waitFor(() => {
      expect(onScroll).toHaveBeenCalledWith(64);
    });
  });

  it('updates rendered content on rerender', async () => {
    const kind = createKind();
    const firstItems = [{ id: 'a', label: 'Alpha' }];
    const secondItems = [{ id: 'b', label: 'Beta' }];

    const { rerender } = render(
      <VirtualPool
        items={firstItems}
        getItemId={(item) => item.id}
        derived={createDerived(firstItems)}
        listState={createState()}
        layoutState={createLayout(firstItems.length)}
        kindMap={{ default: kind, text: kind }}
        fallbackItemHeight={32}
        poolItemHeight={32}
        poolStructureKey="fixed-32"
        height={96}
      />
    );

    expect(await screen.findByText('Alpha')).toBeInTheDocument();

    rerender(
      <VirtualPool
        items={secondItems}
        getItemId={(item) => item.id}
        derived={createDerived(secondItems)}
        listState={createState()}
        layoutState={createLayout(secondItems.length)}
        kindMap={{ default: kind, text: kind }}
        fallbackItemHeight={32}
        poolItemHeight={32}
        poolStructureKey="fixed-32"
        height={96}
      />
    );

    expect(await screen.findByText('Beta')).toBeInTheDocument();
  });

  it('renders empty and loading overlays', async () => {
    const kind = createKind();

    const { rerender } = render(
      <VirtualPool
        items={[]}
        getItemId={(item) => item.id}
        derived={createDerived([])}
        listState={createState()}
        layoutState={createLayout(0)}
        kindMap={{ default: kind, text: kind }}
        fallbackItemHeight={32}
        poolItemHeight={32}
        poolStructureKey="fixed-32"
        height={96}
      />
    );

    expect(await screen.findByTestId('virtual-pool-empty')).toBeInTheDocument();

    rerender(
      <VirtualPool
        items={[]}
        getItemId={(item) => item.id}
        derived={createDerived([])}
        listState={createState()}
        layoutState={createLayout(0)}
        kindMap={{ default: kind, text: kind }}
        fallbackItemHeight={32}
        poolItemHeight={32}
        poolStructureKey="fixed-32"
        height={96}
        isLoading
      />
    );

    expect(await screen.findByTestId('virtual-pool-loading')).toBeInTheDocument();
  });
});



