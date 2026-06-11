/**
 * COLLECTION ENGINE — experimental contracts.
 *
 * Collections (lists, trees, menus, grids) share the same underlying concerns:
 * a set of items, a selection model, and a navigation/focus model. Today each
 * component implements these locally. The goal is to converge them onto the
 * interfaces below so a single engine can drive all of them.
 *
 * This file defines the *target* shape only. Implementations land later.
 */

export type CollectionKey = string;

export interface CollectionItem<T = unknown> {
  key: CollectionKey;
  value: T;
  disabled?: boolean;
  /** Nested items, for tree/menu structures. */
  children?: CollectionItem<T>[];
}

export type SelectionMode = "none" | "single" | "multiple";

export interface SelectionState {
  mode: SelectionMode;
  selectedKeys: Set<CollectionKey>;
}

export interface NavigationState {
  focusedKey: CollectionKey | null;
  expandedKeys: Set<CollectionKey>;
}

/** The unified model a future engine will expose. */
export interface CollectionModel<T = unknown> {
  items: CollectionItem<T>[];
  selection: SelectionState;
  navigation: NavigationState;
}

/** Planned engine surface — intentionally not implemented yet. */
export interface CollectionEngine<T = unknown> {
  getModel(): CollectionModel<T>;
  select(key: CollectionKey): void;
  focus(key: CollectionKey): void;
  toggleExpanded(key: CollectionKey): void;
}
