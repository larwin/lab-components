import { describe, expect, it } from 'vitest';
import { buildCollectionStore } from '../store';
import { computeCollectionDerivedState } from '../derived';
import { createInitialCollectionState } from '../initial';

interface TreeItem {
  id: string;
  parentId: string | null;
}

describe('computeCollectionDerivedState visibility semantics', () => {
  it('sets isVisible for projected runtime entries and omits hidden tree descendants', () => {
    const items: TreeItem[] = [
      { id: 'root', parentId: null },
      { id: 'child', parentId: 'root' },
    ];
    const store = buildCollectionStore(items, (item) => item.id, (item) => item.parentId);

    const collapsed = computeCollectionDerivedState(store, createInitialCollectionState<string>(), {
      hasTree: true,
      getItemKind: () => 'default',
    });
    expect(collapsed.visibleItemIds).toEqual(['root']);
    expect(collapsed.runtimeById.get('root')?.isVisible).toBe(true);
    expect(collapsed.runtimeById.has('child')).toBe(false);

    const expanded = computeCollectionDerivedState(store, {
      ...createInitialCollectionState<string>(),
      expandedItemIds: new Set(['root']),
    }, {
      hasTree: true,
      getItemKind: () => 'default',
    });
    expect(expanded.visibleItemIds).toEqual(['root', 'child']);
    expect(expanded.runtimeById.get('child')?.isVisible).toBe(true);
  });
});
