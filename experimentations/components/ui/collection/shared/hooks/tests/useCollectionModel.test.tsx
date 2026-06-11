import { renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CollectionCache } from '@/core/collection/shared/cache';
import { createTestCulture } from '@/core/culture';
import { defineCollection } from '@/core/collection/shared/definition/facade';
import type { CollectionConfig } from '@/core/collection/shared/definition/types';
import { createRowKindTextDefinition } from '@/core/collection/shared/kind/text';
import type { RowKindDefinition } from '@/core/collection/list/kind/types';
import { createInitialCollectionState } from '@/core/collection/shared/state/initial';
import { useCollectionModel } from '../useCollectionModel';

interface Item {
  id: string;
  label: string;
  parentId?: string | null;
}

const textKind = createRowKindTextDefinition<Item>({
  height: 30,
  getLabel: (item) => item.label,
});

describe('useCollectionModel', () => {
  it('handles empty items', () => {
    const definition = defineCollection<Item>({
      getItemId: (item) => item.id,
      kindMap: { text: textKind },
      getItemKind: () => 'text',
    });

    const { result } = renderHook(() => useCollectionModel({
      items: [],
      definition,
      listState: createInitialCollectionState<string>(),
      cache: new CollectionCache<string>(),
    }));

    expect(result.current.store.orderedIds).toEqual([]);
    expect(result.current.derived.visibleItemIds).toEqual([]);
    expect(result.current.layoutState.totalHeight).toBe(0);
  });

  it('builds flat model with runtime and layout', () => {
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ];
    const definition = defineCollection<Item>({
      getItemId: (item) => item.id,
      kindMap: { text: textKind },
      getItemKind: () => 'text',
    });

    const { result } = renderHook(() => useCollectionModel({
      items,
      definition,
      listState: createInitialCollectionState<string>(),
      cache: new CollectionCache<string>(),
    }));

    expect(result.current.derived.visibleItemIds).toEqual(['a', 'b']);
    expect(result.current.derived.runtimeById.get('a')?.kind).toBe('text');
    expect(result.current.layoutState.totalHeight).toBe(60);
  });

  it('supports tree data and expanded state', () => {
    const items = [
      { id: 'root', label: 'Root', parentId: null },
      { id: 'child', label: 'Child', parentId: 'root' },
    ];
    const definition = defineCollection<Item>({
      getItemId: (item) => item.id,
      kindMap: { text: textKind },
      getItemKind: () => 'text',
      hierarchy: {
        getId: (item) => item.id,
        getParentId: (item) => item.parentId ?? null,
      },
    });

    const cache = new CollectionCache<string>();
    const { result, rerender } = renderHook(
      ({ expanded }: { expanded: Set<string> }) => useCollectionModel({
        items,
        definition,
        listState: {
          ...createInitialCollectionState<string>(),
          expandedItemIds: expanded,
        },
        cache,
      }),
      {
        initialProps: { expanded: new Set<string>() },
      }
    );

    expect(result.current.derived.visibleItemIds).toEqual(['root']);

    rerender({ expanded: new Set(['root']) });
    expect(result.current.derived.visibleItemIds).toEqual(['root', 'child']);
  });

  it('forwards culture and uses cache for getItemKind values', () => {
    const culture = createTestCulture('fr-FR');
    culture.translate = (key) => (key === 'list.greeting' ? 'Bonjour' : key);
    const getItemKind = vi.fn(() => 'translated');
    const translatedKind: RowKindDefinition<Item, string, any, any, { labelEl: HTMLSpanElement }> = {
      kind: 'translated',
      height: 28,
      computeDescriptor: (_item, _id, _runtime, passedCulture) => ({
        label: passedCulture?.translate('list.greeting'),
      }),
      create: (container) => {
        const labelEl = document.createElement('span');
        container.appendChild(labelEl);
        return { labelEl };
      },
      update: () => {},
    };

    const definition = defineCollection<Item>({
      getItemId: (item) => item.id,
      getItemKind,
      kindMap: {
        translated: translatedKind as any,
      },
      culture,
    });
    const items = [{ id: 'a', label: 'Alpha' }];
    const cache = new CollectionCache<string>();

    const { result, rerender } = renderHook(
      ({ listItems }: { listItems: Item[] }) => useCollectionModel({
        items: listItems,
        definition,
        listState: createInitialCollectionState<string>(),
        cache,
      }),
      { initialProps: { listItems: items } }
    );

    expect(result.current.activeCulture?.translate('list.greeting')).toBe('Bonjour');
    expect(result.current.derived.runtimeById.get('a')?.kind).toBe('translated');
    expect(getItemKind).toHaveBeenCalledTimes(1);
    expect(getItemKind).toHaveBeenNthCalledWith(1, items[0], culture);

    rerender({ listItems: [...items] });
    expect(getItemKind).toHaveBeenCalledTimes(1);

    rerender({
      listItems: [
        ...items,
        { id: 'b', label: 'Beta' },
      ],
    });
    expect(getItemKind).toHaveBeenCalledTimes(3);
  });

  it('keeps policy and layout references stable when inputs do not change', () => {
    const items = [{ id: 'a', label: 'Alpha' }];
    const definition = defineCollection<Item>({
      getItemId: (item) => item.id,
      kindMap: { text: textKind },
      getItemKind: () => 'text',
    });
    const listState = createInitialCollectionState<string>();
    const cache = new CollectionCache<string>();

    const { result, rerender } = renderHook(() => useCollectionModel({
      items,
      definition,
      listState,
      cache,
    }));

    const policyRef = result.current.policy;
    const layoutRef = result.current.layoutState;

    rerender();

    expect(result.current.policy).toBe(policyRef);
    expect(result.current.layoutState).toBe(layoutRef);
  });

  it('uses configured defaultKind when getItemKind is not provided', () => {
    const customKind = createRowKindTextDefinition<Item>({
      height: 24,
      getLabel: (item) => item.label,
    });

    const definition: CollectionConfig<Item, string> = {
      getItemId: (item) => item.id,
      kindMap: {
        custom: customKind as any,
        default: customKind as any,
      },
      defaultKind: 'custom',
      capabilities: {
        selection: 'multi',
        check: false,
        expand: false,
      },
    };

    const { result } = renderHook(() => useCollectionModel({
      items: [{ id: 'a', label: 'Alpha' }],
      definition,
      listState: createInitialCollectionState<string>(),
      cache: new CollectionCache<string>(),
    }));

    expect(result.current.derived.runtimeById.get('a')?.kind).toBe('custom');
  });

  it('works under StrictMode without memo side effects', () => {
    const definition = defineCollection<Item>({
      getItemId: (item) => item.id,
      kindMap: { text: textKind },
      getItemKind: () => 'text',
    });
    const cache = new CollectionCache<string>();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    const { result } = renderHook(() => useCollectionModel({
      items: [{ id: 'a', label: 'Alpha' }],
      definition,
      listState: createInitialCollectionState<string>(),
      cache,
    }), { wrapper });

    expect(result.current.derived.visibleItemIds).toEqual(['a']);
    expect(result.current.layoutState.totalHeight).toBe(30);
  });
});
