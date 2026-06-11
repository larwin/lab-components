import { describe, expect, it } from 'vitest';
import { buildCollectionStore } from '../store';

interface Item {
  id: string;
  parentId?: string | null;
}

describe('buildCollectionStore', () => {
  it('builds ordered ids and parent/children maps', () => {
    const items: Item[] = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
    ];

    const store = buildCollectionStore(items, (item) => item.id, (item) => item.parentId ?? null);

    expect(store.orderedIds).toEqual(['a', 'b']);
    expect(store.parentById.get('a')).toBeNull();
    expect(store.parentById.get('b')).toBe('a');
    expect(store.childrenById.get('a')).toEqual(['b']);
  });

  it('throws when duplicate ids are provided', () => {
    const items: Item[] = [
      { id: 'a', parentId: null },
      { id: 'a', parentId: null },
    ];

    expect(() => buildCollectionStore(items, (item) => item.id, (item) => item.parentId ?? null))
      .toThrow('[Collection] Duplicate item id "a" detected.');
  });
});
