import { describe, expect, it } from 'vitest';
import {
  closeCascade,
  closeSubmenu,
  openSubmenu,
  resolveMenuKeyboardIntent,
  type MenuKeyboardContext,
} from '../keyboard';

function createContext(overrides?: Partial<MenuKeyboardContext<string>>): MenuKeyboardContext<string> {
  return {
    levelId: 'level-1',
    hasParentLevel: true,
    focusedItemId: 'open',
    itemById: new Map([
      ['open', { id: 'open', kind: 'action', actionId: 'open', submenu: { key: 'sub', items: [] } }],
      ['plain', { id: 'plain', kind: 'action', actionId: 'run' }],
      ['disabled', { id: 'disabled', kind: 'action', actionId: 'run', submenu: { key: 'sub', items: [] }, disabled: true }],
      ['separator', { id: 'separator', kind: 'separator' }],
    ]),
    ...overrides,
  };
}

describe('menu keyboard helpers', () => {
  it('openSubmenu builds OPEN_SUBMENU intent for focused submenu item', () => {
    expect(openSubmenu(createContext())).toEqual({
      type: 'OPEN_SUBMENU',
      levelId: 'level-1',
      itemId: 'open',
    });
  });

  it('openSubmenu returns null without openable focused item', () => {
    expect(openSubmenu(createContext({ focusedItemId: null }))).toBeNull();
    expect(openSubmenu(createContext({ focusedItemId: 'plain' }))).toBeNull();
    expect(openSubmenu(createContext({ focusedItemId: 'disabled' }))).toBeNull();
    expect(openSubmenu(createContext({ focusedItemId: 'separator' }))).toBeNull();
  });

  it('closeSubmenu returns CLOSE_SUBMENU only for nested levels', () => {
    expect(closeSubmenu(createContext())).toEqual({
      type: 'CLOSE_SUBMENU',
      levelId: 'level-1',
    });
    expect(closeSubmenu(createContext({ hasParentLevel: false }))).toBeNull();
  });

  it('closeCascade always returns CLOSE_CASCADE intent', () => {
    expect(closeCascade(createContext())).toEqual({
      type: 'CLOSE_CASCADE',
      levelId: 'level-1',
    });
  });

  it('resolveMenuKeyboardIntent maps directional keys', () => {
    const ctx = createContext();
    expect(resolveMenuKeyboardIntent('ArrowRight', ctx)).toEqual({
      type: 'OPEN_SUBMENU',
      levelId: 'level-1',
      itemId: 'open',
    });
    expect(resolveMenuKeyboardIntent('ArrowLeft', ctx)).toEqual({
      type: 'CLOSE_SUBMENU',
      levelId: 'level-1',
    });
    expect(resolveMenuKeyboardIntent('Escape', ctx)).toEqual({
      type: 'CLOSE_CASCADE',
      levelId: 'level-1',
    });
  });

  it('resolveMenuKeyboardIntent returns null for unsupported keys', () => {
    expect(resolveMenuKeyboardIntent('Enter', createContext())).toBeNull();
  });
});


