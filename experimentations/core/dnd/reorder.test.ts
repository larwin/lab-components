import { describe, expect, it } from 'vitest';
import { resolveReorder } from './reorder';

describe('resolveReorder', () => {
  it('returns null when there is no dragged key', () => {
    expect(
      resolveReorder({
        draggedKeys: [],
        targetKey: 'b',
        zone: 'before',
        orderedKeys: ['a', 'b', 'c'],
      }),
    ).toBeNull();
  });

  it('returns null for non-reorder zones', () => {
    expect(
      resolveReorder({
        draggedKeys: ['a'],
        targetKey: 'b',
        zone: 'inside',
        orderedKeys: ['a', 'b', 'c'],
      }),
    ).toBeNull();
    expect(
      resolveReorder({
        draggedKeys: ['a'],
        targetKey: 'b',
        zone: 'none',
        orderedKeys: ['a', 'b', 'c'],
      }),
    ).toBeNull();
  });

  it('resolves a basic before insertion index', () => {
    expect(
      resolveReorder({
        draggedKeys: ['a'],
        targetKey: 'c',
        zone: 'before',
        orderedKeys: ['a', 'b', 'c', 'd'],
      }),
    ).toEqual({ insertIndex: 1 });
  });

  it('resolves a basic after insertion index', () => {
    expect(
      resolveReorder({
        draggedKeys: ['a'],
        targetKey: 'c',
        zone: 'after',
        orderedKeys: ['a', 'b', 'c', 'd'],
      }),
    ).toEqual({ insertIndex: 2 });
  });

  it('keeps a stable insertion index when the target is inside the dragged block', () => {
    expect(
      resolveReorder({
        draggedKeys: ['b', 'c'],
        targetKey: 'c',
        zone: 'after',
        orderedKeys: ['a', 'b', 'c', 'd'],
      }),
    ).toEqual({ insertIndex: 1 });
    expect(
      resolveReorder({
        draggedKeys: ['b', 'c'],
        targetKey: 'b',
        zone: 'before',
        orderedKeys: ['a', 'b', 'c', 'd'],
      }),
    ).toEqual({ insertIndex: 1 });
  });

  it('supports moving a multi-selection before a later target', () => {
    expect(
      resolveReorder({
        draggedKeys: ['b', 'c'],
        targetKey: 'e',
        zone: 'before',
        orderedKeys: ['a', 'b', 'c', 'd', 'e'],
      }),
    ).toEqual({ insertIndex: 2 });
  });

  it('returns null when the target key is missing from the ordered keys', () => {
    expect(
      resolveReorder({
        draggedKeys: ['a'],
        targetKey: 'z',
        zone: 'before',
        orderedKeys: ['a', 'b', 'c'],
      }),
    ).toBeNull();
  });

  it('returns null when none of the dragged keys exist in the ordered keys', () => {
    expect(
      resolveReorder({
        draggedKeys: ['z'],
        targetKey: 'b',
        zone: 'before',
        orderedKeys: ['a', 'b', 'c'],
      }),
    ).toBeNull();
  });
});
