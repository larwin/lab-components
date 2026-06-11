import { describe, expect, it } from 'vitest';
import type { CollectionCapabilities } from '../../definition/types';
import { reduceCollection, type CollectionReduceContext } from '../reducer';
import type { CollectionState } from '../types';

type Id = string;

function createState(focusedItemId: Id | null): CollectionState<Id> {
  return {
    focusedItemId,
    selectedItemIds: new Set<Id>(),
    checkedItemIds: new Set<Id>(),
    expandedItemIds: new Set<Id>(),
    disabledItemIds: new Set<Id>(),
  };
}

function createContext(
  visibleItemIds: Id[],
  disabled: Id[] = [],
  capabilities?: CollectionCapabilities,
): CollectionReduceContext<Id> {
  const disabledSet = new Set(disabled);
  const visibleItemIdSet = new Set(visibleItemIds);
  const visibleIndexById = new Map(visibleItemIds.map((id, index) => [id, index] as const));
  return {
    visibleItemIds,
    visibleItemIdSet,
    visibleIndexById,
    capabilities,
    isFocusable: (id) => !disabledSet.has(id),
  };
}

describe('reduceCollection page navigation', () => {
  it('FOCUS_PAGE_DOWN clamps to the last reachable focusable item at the end', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const state = createState('c');
    const result = reduceCollection(state, { type: 'FOCUS_PAGE_DOWN' }, createContext(ids));

    expect(result.state.focusedItemId).toBe('e');
    expect(result.effects).toEqual([
      { type: 'FOCUS_DOM_ITEM', itemId: 'e' },
      { type: 'SCROLL_TO_ITEM', itemId: 'e', align: 'auto' },
    ]);
  });

  it('FOCUS_PAGE_UP clamps to the first reachable focusable item at the start', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const state = createState('c');
    const result = reduceCollection(state, { type: 'FOCUS_PAGE_UP' }, createContext(ids));

    expect(result.state.focusedItemId).toBe('a');
    expect(result.effects).toEqual([
      { type: 'FOCUS_DOM_ITEM', itemId: 'a' },
      { type: 'SCROLL_TO_ITEM', itemId: 'a', align: 'auto' },
    ]);
  });

  it('skips disabled items while paging and keeps the last reachable focusable item', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];

    const down = reduceCollection(
      createState('b'),
      { type: 'FOCUS_PAGE_DOWN' },
      createContext(ids, ['c', 'd']),
    );
    expect(down.state.focusedItemId).toBe('e');

    const up = reduceCollection(
      createState('e'),
      { type: 'FOCUS_PAGE_UP' },
      createContext(ids, ['a', 'c', 'd']),
    );
    expect(up.state.focusedItemId).toBe('b');
  });

  it('blocks checkbox toggles when capabilities.check is false', () => {
    const state = createState('b');
    const result = reduceCollection(
      state,
      { type: 'TOGGLE_CHECKBOX_ITEM' },
      createContext(['a', 'b', 'c'], [], { check: false, expand: true, selection: 'multi' }),
    );

    expect(result.state.checkedItemIds.size).toBe(0);
  });

  it('blocks expand toggles when capabilities.expand is false', () => {
    const state = createState('b');

    const direct = reduceCollection(
      state,
      { type: 'TOGGLE_EXPAND_ITEM', itemId: 'b' },
      createContext(['a', 'b', 'c'], [], { check: true, expand: false, selection: 'multi' }),
    );
    expect(direct.state.expandedItemIds.size).toBe(0);

    const byKeyboard = reduceCollection(
      state,
      { type: 'KEY_DOWN', key: 'ArrowRight', modifiers: { ctrl: false, meta: false, shift: false } },
      createContext(['a', 'b', 'c'], [], { check: true, expand: false, selection: 'multi' }),
    );
    expect(byKeyboard.state.expandedItemIds.size).toBe(0);
  });

  it('defaults to multi selection when capabilities.selection is undefined', () => {
    const state = createState('a');
    const result = reduceCollection(
      state,
      { type: 'CLICK_ITEM', itemId: 'b', modifiers: { ctrl: true, meta: false, shift: false } },
      createContext(['a', 'b', 'c'], [], { check: true, expand: true }),
    );

    expect(result.state.selectedItemIds.has('b')).toBe(true);
  });
});
