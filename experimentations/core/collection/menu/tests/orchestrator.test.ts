import { describe, expect, it } from 'vitest';
import { createClosedMenuState, reduceMenu } from '../orchestrator';
import type { MenuDefinition } from '../types';

const definition: MenuDefinition<string> = {
  key: 'root',
  items: [
    {
      id: 'file',
      kind: 'action',
      actionId: 'file',
      submenu: {
        key: 'file-submenu',
        items: [
          { id: 'open', kind: 'action', actionId: 'open' },
          { id: 'close', kind: 'action', actionId: 'close' },
        ],
      },
    },
    { id: 'separator', kind: 'separator' },
    { id: 'quit', kind: 'action', actionId: 'quit' },
  ],
};

const focusDefinition: MenuDefinition<string> = {
  key: 'focus-root',
  items: [
    { id: 'separator', kind: 'separator' },
    { id: 'disabled', kind: 'action', actionId: 'disabled', disabled: true },
    { id: 'first-focusable', kind: 'action', actionId: 'first-focusable' },
  ],
};

describe('reduceMenu', () => {
  it('opens root level on OPEN_MENU', () => {
    const result = reduceMenu(createClosedMenuState<string>(), {
      type: 'OPEN_MENU',
      definition,
    });

    expect(result.state.levels).toHaveLength(1);
    expect(result.state.levels[0]?.id).toBe('level-0');
    expect(result.state.levels[0]?.state.listState.focusedItemId).toBe('file');
  });

  it('opens submenu level and keeps parent focus on opener item', () => {
    const opened = reduceMenu(createClosedMenuState<string>(), {
      type: 'OPEN_MENU',
      definition,
    });

    const withSubmenu = reduceMenu(opened.state, {
      type: 'OPEN_SUBMENU',
      levelId: 'level-0',
      itemId: 'file',
    });

    expect(withSubmenu.state.levels).toHaveLength(2);
    expect(withSubmenu.state.levels[1]?.parentLevelId).toBe('level-0');
    expect(withSubmenu.state.levels[1]?.parentItemId).toBe('file');
    expect(withSubmenu.state.levels[0]?.state.listState.focusedItemId).toBe('file');
    expect(withSubmenu.state.levels[1]?.state.listState.focusedItemId).toBe('open');
  });

  it('focuses first focusable item when opening menu', () => {
    const result = reduceMenu(createClosedMenuState<string>(), {
      type: 'OPEN_MENU',
      definition: focusDefinition,
    });

    expect(result.state.levels[0]?.state.listState.focusedItemId).toBe('first-focusable');
  });

  it('ESCAPE closes current submenu and restores focus to parent item', () => {
    const opened = reduceMenu(createClosedMenuState<string>(), {
      type: 'OPEN_MENU',
      definition,
    });
    const withSubmenu = reduceMenu(opened.state, {
      type: 'OPEN_SUBMENU',
      levelId: 'level-0',
      itemId: 'file',
    });

    const escaped = reduceMenu(withSubmenu.state, {
      type: 'ESCAPE',
      levelId: 'level-1',
    });

    expect(escaped.state.levels).toHaveLength(1);
    expect(escaped.state.levels[0]?.state.listState.focusedItemId).toBe('file');
  });

  it('CLOSE_CASCADE closes all levels', () => {
    const opened = reduceMenu(createClosedMenuState<string>(), {
      type: 'OPEN_MENU',
      definition,
    });
    const withSubmenu = reduceMenu(opened.state, {
      type: 'OPEN_SUBMENU',
      levelId: 'level-0',
      itemId: 'file',
    });

    const closed = reduceMenu(withSubmenu.state, {
      type: 'CLOSE_CASCADE',
      levelId: 'level-1',
    });

    expect(closed.state.levels).toHaveLength(0);
    expect(closed.state.rootMenu).toBeNull();
  });
});


