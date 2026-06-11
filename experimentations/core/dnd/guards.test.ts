import { describe, expect, it } from 'vitest';
import { hasMixedTypes } from './guards';

describe('hasMixedTypes', () => {
  it('returns false for an empty list', () => {
    expect(hasMixedTypes([])).toBe(false);
  });

  it('returns false for a single item', () => {
    expect(hasMixedTypes([{ id: 'name', type: 'grid.column' }])).toBe(false);
  });

  it('returns false when all items share the same type', () => {
    expect(
      hasMixedTypes([
        { id: 'name', type: 'grid.column' },
        { id: 'role', type: 'grid.column' },
      ]),
    ).toBe(false);
  });

  it('returns true when at least one item has a different type', () => {
    expect(
      hasMixedTypes([
        { id: 'name', type: 'grid.column' },
        { id: 'row-1', type: 'grid.row' },
      ]),
    ).toBe(true);
  });
});
