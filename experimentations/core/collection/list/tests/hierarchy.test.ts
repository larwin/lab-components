import { describe, it, expect } from 'vitest';
import type { HierarchyDefinition, HierarchyRuntime } from '@/core/collection/shared/hierarchy';
import { FLAT_HIERARCHY } from '@/core/collection/shared/hierarchy';

interface FileItem {
  id: string;
  name: string;
  parentId: string | null;
}

describe('HierarchyDefinition', () => {
  const definition: HierarchyDefinition<FileItem, string> = {
    getId: (item) => item.id,
    getParentId: (item) => item.parentId,
  };

  it('builds a hierarchy definition with getId/getParentId', () => {
    expect(definition.getId({ id: 'folder-1', name: 'Documents', parentId: null })).toBe('folder-1');
    expect(definition.getParentId({ id: 'file-1', name: 'report.pdf', parentId: 'folder-1' })).toBe('folder-1');
  });

  it('supports null parentId for root items', () => {
    expect(definition.getParentId({ id: 'folder-1', name: 'Documents', parentId: null })).toBeNull();
  });
});

describe('FLAT_HIERARCHY', () => {
  it('provides flat-safe defaults', () => {
    expect(FLAT_HIERARCHY).toEqual({
      depth: 0,
      parentId: null,
      childrenIds: [],
      hasChildren: false,
    });
  });
});

describe('HierarchyRuntime shape', () => {
  it('accepts a tree runtime payload', () => {
    const runtime: HierarchyRuntime = {
      depth: 2,
      parentId: 'folder-1',
      childrenIds: ['file-1', 'file-2'],
      hasChildren: true,
    };

    expect(runtime.depth).toBe(2);
    expect(runtime.parentId).toBe('folder-1');
    expect(runtime.childrenIds).toHaveLength(2);
    expect(runtime.hasChildren).toBe(true);
  });
});


