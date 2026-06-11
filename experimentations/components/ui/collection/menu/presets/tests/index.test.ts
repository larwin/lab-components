import { describe, expect, it } from 'vitest';
import { MENU_EXTENDED_ITEM_HEIGHT, MENU_ITEM_HEIGHT } from '@/core/collection/menu/constants';
import { createMenuPresetKindMap } from '../index';

describe('createMenuPresetKindMap', () => {
  it('returns the five built-in menu preset kinds', () => {
    const kindMap = createMenuPresetKindMap<string>();

    expect(kindMap.action).toBeDefined();
    expect(kindMap.checkbox).toBeDefined();
    expect(kindMap.input).toBeDefined();
    expect(kindMap.enum).toBeDefined();
    expect(kindMap.separator).toBeDefined();
  });

  it('uses expected default heights', () => {
    const kindMap = createMenuPresetKindMap<string>();

    expect(kindMap.action?.height).toBe(MENU_ITEM_HEIGHT);
    expect(kindMap.checkbox?.height).toBe(MENU_ITEM_HEIGHT);
    expect(kindMap.input?.height).toBe(MENU_EXTENDED_ITEM_HEIGHT);
    expect(kindMap.enum?.height).toBe(MENU_EXTENDED_ITEM_HEIGHT);
  });
});




