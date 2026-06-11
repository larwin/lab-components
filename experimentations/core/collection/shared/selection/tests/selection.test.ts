import { describe, expect, it } from 'vitest';
import { DEFAULT_SELECTION_MODE, type SelectionMode, type SelectionState } from '../selection';

describe('selection types', () => {
  it('supports all selection modes', () => {
    const modes: SelectionMode[] = ['none', 'single', 'multi'];
    expect(modes).toEqual(['none', 'single', 'multi']);
  });

  it('accepts SelectionState shape', () => {
    const state: SelectionState<string> = {
      selectedItemIds: new Set(['a', 'b']),
      mode: 'multi',
    };

    expect([...state.selectedItemIds]).toEqual(['a', 'b']);
    expect(state.mode).toBe('multi');
  });

  it('exposes multi as default mode', () => {
    expect(DEFAULT_SELECTION_MODE).toBe('multi');
  });
});
