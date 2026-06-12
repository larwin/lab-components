import type { Collection, Key } from "../collection/collection";
import type { SelectionMode } from "../collection/selection";
import type { BehaviorContext } from "./behavior";

/**
 * Shared configuration for collection-driven behaviors (Navigable, Selectable,
 * Expandable). The collection is provided as a getter so the same machine can
 * survive data updates: the adapter swaps the collection without rebuilding
 * navigation/selection state.
 */
export interface CollectionBehaviorConfig<T = unknown> {
  getCollection(): Collection<T>;
  selectionMode?: SelectionMode;
  /** Arrow navigation also selects (single-select listboxes, menus). */
  selectionFollowsFocus?: boolean;
  /** Arrow navigation wraps around the ends. */
  wrap?: boolean;
  /** PageUp/PageDown jump size. Adapters may override per viewport. */
  pageSize?: number;
  /** BCP 47 locale for typeahead collation. */
  locale?: string;
}

export interface ExpansionReader {
  readonly expandedKeys: ReadonlySet<Key>;
}

/** Visible sequence for the current expansion state (all keys when flat). */
export function visibleKeysOf<T>(
  ctx: BehaviorContext<CollectionBehaviorConfig<T>>,
): readonly Key[] {
  const collection = ctx.config.getCollection();
  const expansion = ctx.read<ExpansionReader>("expandable");
  return collection.visibleKeys(expansion?.expandedKeys);
}
