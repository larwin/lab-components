import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CollectionCache } from '@/core/collection/shared/cache';
import { defineCollection } from '@/core/collection/shared/definition/facade';
import type { CollectionCapabilities } from '@/core/collection/shared/definition/types';
import { createRowKindTextDefinition } from '@/core/collection/shared/kind/text';
import { useCollectionController } from '../useCollectionController';

interface Item {
  id: string;
  label: string;
}

const textKind = createRowKindTextDefinition<Item>({
  height: 28,
  getLabel: (item) => item.label,
});

function createDefinition(capabilities?: CollectionCapabilities) {
  return defineCollection<Item>({
    getItemId: (item) => item.id,
    kindMap: {
      text: textKind,
    },
    getItemKind: () => 'text',
    capabilities,
  });
}

describe('useCollectionController', () => {
  it('owns collectionState and model', () => {
    const { result } = renderHook(() => useCollectionController({
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      definition: createDefinition(),
      cache: new CollectionCache<string>(),
    }));

    expect(result.current.model.derived.visibleItemIds).toEqual(['a', 'b']);
    expect(result.current.model.layoutState.totalHeight).toBe(56);
    expect(result.current.collectionState.focusedItemId).toBeNull();
    expect(result.current.listState).toBe(result.current.collectionState);
  });

  it('dispatches intents and updates collectionState', () => {
    const onLastIntent = vi.fn();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() => useCollectionController({
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      definition: createDefinition(),
      cache: new CollectionCache<string>(),
      onLastIntent,
      onSelectionChange,
    }));

    act(() => {
      result.current.dispatchIntent({
        type: 'CLICK_ITEM',
        itemId: 'a',
        modifiers: { ctrl: false, meta: false, shift: false },
      });
    });

    expect(onLastIntent).toHaveBeenCalledWith(expect.objectContaining({ type: 'CLICK_ITEM', itemId: 'a' }));
    expect(result.current.collectionState.focusedItemId).toBe('a');
    expect(result.current.collectionState.selectedItemIds.has('a')).toBe(true);
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['a']));
  });

  it('handles keyboard navigation', () => {
    const onLastIntent = vi.fn();

    const { result } = renderHook(() => useCollectionController({
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      definition: createDefinition(),
      cache: new CollectionCache<string>(),
      onLastIntent,
    }));

    const target = document.createElement('div');
    const preventDefault = vi.fn();
    act(() => {
      result.current.handleKeyDown({
        key: 'ArrowDown',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        target,
        preventDefault,
        nativeEvent: new KeyboardEvent('keydown', { key: 'ArrowDown' }),
      } as unknown as React.KeyboardEvent<HTMLElement>);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(onLastIntent).toHaveBeenCalledWith(expect.objectContaining({ type: 'KEY_DOWN', key: 'ArrowDown' }));
    expect(result.current.collectionState.focusedItemId).toBe('a');
  });

  it('merges override capabilities with definition capabilities', () => {
    const onLastIntent = vi.fn();
    const preventDefault = vi.fn();
    const target = document.createElement('div');

    const { result } = renderHook(() => useCollectionController({
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      definition: createDefinition({ selection: 'none', check: false, expand: false }),
      cache: new CollectionCache<string>(),
      capabilities: { check: true },
      onLastIntent,
    }));

    act(() => {
      result.current.handleKeyDown({
        key: 'a',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        target,
        preventDefault,
        nativeEvent: new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }),
      } as unknown as React.KeyboardEvent<HTMLElement>);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(onLastIntent).not.toHaveBeenCalled();
  });
});
