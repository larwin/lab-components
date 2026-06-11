import type { ItemId } from '@/core/collection/shared/runtime';

/**
 * HierarchyDefinition<TItem, TId> - describes how to navigate the tree structure.
 */
export interface HierarchyDefinition<TItem, TId extends ItemId = ItemId> {
  /** Returns the unique identifier of an item. */
  getId: (item: TItem) => TId;

  /** Returns the parent identifier. Return null for root-level items. */
  getParentId: (item: TItem) => TId | null;
}

/**
 * HierarchyRuntime - the hierarchy context for a single item.
 */
export interface HierarchyRuntime {
  /** Distance from root. 0 = root node. */
  depth: number;

  /** ItemId of the parent, null if root. */
  parentId: ItemId | null;

  /** ItemIds of direct children (all children, not just visible ones). */
  childrenIds: ItemId[];

  /** Shortcut: childrenIds.length > 0 */
  hasChildren: boolean;
}

export const FLAT_HIERARCHY: HierarchyRuntime = {
  depth: 0,
  parentId: null,
  childrenIds: [],
  hasChildren: false,
};
