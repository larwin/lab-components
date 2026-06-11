import { describe, it, expect } from 'vitest';
import {
  getFirstFocusableId,
  getLastFocusableId,
  getNextFocusableId,
  getPrevFocusableId,
} from '../keyboard';

const ids = ['a', 'b', 'c', 'd', 'e'] as const;

function createFocusablePredicate(disabledIds: string[]): (id: string) => boolean {
  const disabled = new Set(disabledIds);
  return (id) => !disabled.has(id);
}

describe('focus navigation', () => {
  it('getFirstFocusableId returns first focusable item', () => {
    const isFocusable = createFocusablePredicate(['a']);

    expect(getFirstFocusableId([...ids], isFocusable)).toBe('b');
  });

  it('getLastFocusableId returns last focusable item', () => {
    const isFocusable = createFocusablePredicate(['e']);

    expect(getLastFocusableId([...ids], isFocusable)).toBe('d');
  });

  it('getNextFocusableId skips disabled items', () => {
    const isFocusable = createFocusablePredicate(['c', 'd']);

    expect(getNextFocusableId([...ids], 'b', isFocusable)).toBe('e');
  });

  it('getPrevFocusableId skips disabled items', () => {
    const isFocusable = createFocusablePredicate(['b', 'c']);

    expect(getPrevFocusableId([...ids], 'd', isFocusable)).toBe('a');
  });

  it('returns current item at list edges (no wrap)', () => {
    const isFocusable = createFocusablePredicate([]);

    expect(getNextFocusableId([...ids], 'e', isFocusable)).toBe('e');
    expect(getPrevFocusableId([...ids], 'a', isFocusable)).toBe('a');
  });

  it('returns null for empty list', () => {
    const isFocusable = createFocusablePredicate([]);

    expect(getFirstFocusableId([], isFocusable)).toBeNull();
    expect(getLastFocusableId([], isFocusable)).toBeNull();
    expect(getNextFocusableId([], null, isFocusable)).toBeNull();
    expect(getPrevFocusableId([], null, isFocusable)).toBeNull();
  });

  it('supports one single focusable item', () => {
    const only = ['x', 'y', 'z'];
    const isFocusable = (id: string) => id === 'y';

    expect(getFirstFocusableId(only, isFocusable)).toBe('y');
    expect(getLastFocusableId(only, isFocusable)).toBe('y');
    expect(getNextFocusableId(only, null, isFocusable)).toBe('y');
    expect(getPrevFocusableId(only, null, isFocusable)).toBe('y');
  });

  it('uses first/last focusable when currentId is null or missing', () => {
    const isFocusable = createFocusablePredicate(['a', 'e']);

    expect(getNextFocusableId([...ids], null, isFocusable)).toBe('b');
    expect(getPrevFocusableId([...ids], null, isFocusable)).toBe('d');
    expect(getNextFocusableId([...ids], 'missing', isFocusable)).toBe('b');
    expect(getPrevFocusableId([...ids], 'missing', isFocusable)).toBe('d');
  });
});

