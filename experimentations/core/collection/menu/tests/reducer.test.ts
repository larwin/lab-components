import { describe, expect, it } from 'vitest';
import { createInitialCollectionState } from '@/core/collection/shared/state/initial';
import { reduceMenuLevel, type MenuLevelState, type MenuReduceContext } from '../reducer';
import type { MenuItemDefinition } from '../types';

const items: Array<MenuItemDefinition<string>> = [
  { id: 'open', kind: 'action', actionId: 'open' },
  { id: 'checked', kind: 'checkbox' },
  { id: 'input', kind: 'input', draft: '', debounceMs: 180 },
  { id: 'status', kind: 'enum', values: ['active', 'archived'], selectedValues: [] },
];

function createContext(): MenuReduceContext<string> {
  return {
    visibleItemIds: items.map((item) => item.id),
    isFocusable: () => true,
    itemById: new Map(items.map((item) => [item.id, item])),
  };
}

function createState(): MenuLevelState<string> {
  return {
    listState: createInitialCollectionState<string>(),
    runtimeById: new Map(),
  };
}

describe('reduceMenuLevel', () => {
  it('toggles checkbox via list intent and mirrors checked runtime', () => {
    const result = reduceMenuLevel(
      createState(),
      { type: 'TOGGLE_CHECKBOX_ITEM', itemId: 'checked' },
      createContext(),
    );

    expect(result.state.listState.checkedItemIds.has('checked')).toBe(true);
    expect(result.state.runtimeById.get('checked')?.checked).toBe(true);
  });

  it('drafts input and schedules APPLY_INPUT_ITEM with debounce', () => {
    const result = reduceMenuLevel(
      createState(),
      { type: 'DRAFT_INPUT_ITEM', itemId: 'input', draft: 'alice' },
      createContext(),
    );

    expect(result.state.runtimeById.get('input')?.draft).toBe('alice');
    expect(result.effects).toEqual([
      {
        type: 'CANCEL_SCHEDULE',
        key: 'menu:input:input',
      },
      {
        type: 'SCHEDULE_INTENT',
        key: 'menu:input:input',
        delayMs: 180,
        intent: {
          type: 'APPLY_INPUT_ITEM',
          itemId: 'input',
          origin: 'debounce',
        },
      },
    ]);
  });

  it('applies input draft and emits filter change', () => {
    const state = createState();
    state.runtimeById.set('input', { draft: 'alice' });

    const result = reduceMenuLevel(
      state,
      { type: 'APPLY_INPUT_ITEM', itemId: 'input', origin: 'enter' },
      createContext(),
    );

    expect(result.state.runtimeById.get('input')).toMatchObject({
      draft: 'alice',
      inputValue: 'alice',
    });
    expect(result.effects).toEqual([
      {
        type: 'CANCEL_SCHEDULE',
        key: 'menu:input:input',
      },
      {
        type: 'EMIT_COLUMN_FILTER_CHANGE',
        itemId: 'input',
        value: 'alice',
      },
    ]);
  });

  it('cancels pending debounce before apply on immediate origin', () => {
    const state = createState();
    state.runtimeById.set('input', { draft: 'alice' });

    const result = reduceMenuLevel(
      state,
      { type: 'APPLY_INPUT_ITEM', itemId: 'input', origin: 'blur' },
      createContext(),
    );

    expect(result.effects[0]).toEqual({
      type: 'CANCEL_SCHEDULE',
      key: 'menu:input:input',
    });
    expect(result.effects[1]).toEqual({
      type: 'EMIT_COLUMN_FILTER_CHANGE',
      itemId: 'input',
      value: 'alice',
    });
  });

  it('toggles enum value and emits filter changes', () => {
    const state = createState();

    const added = reduceMenuLevel(
      state,
      { type: 'TOGGLE_ENUM_VALUE', itemId: 'status', value: 'active' },
      createContext(),
    );
    expect(added.state.runtimeById.get('status')?.enumSelectedValues).toEqual(['active']);
    expect(added.effects).toEqual([
      {
        type: 'EMIT_COLUMN_FILTER_CHANGE',
        itemId: 'status',
        value: ['active'],
      },
    ]);

    const removed = reduceMenuLevel(
      added.state,
      { type: 'TOGGLE_ENUM_VALUE', itemId: 'status', value: 'active' },
      createContext(),
    );
    expect(removed.state.runtimeById.get('status')?.enumSelectedValues).toEqual([]);
    expect(removed.effects).toEqual([
      {
        type: 'EMIT_COLUMN_FILTER_CHANGE',
        itemId: 'status',
        value: null,
      },
    ]);
  });

  it('emits execute effect for action items', () => {
    const result = reduceMenuLevel(
      createState(),
      { type: 'EXECUTE_MENU_ITEM', itemId: 'open', source: 'enter' },
      createContext(),
    );

    expect(result.effects).toEqual([
      {
        type: 'EMIT_EXECUTE',
        itemId: 'open',
        actionId: 'open',
      },
    ]);
  });
});




