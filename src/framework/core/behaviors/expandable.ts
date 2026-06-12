import { defineBehavior } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";
import { withEffects, type TransitionResult } from "../runtime/machine";
import type { Key } from "../collection/collection";
import type { CollectionBehaviorConfig } from "./collection-config";
import { navIntents, type NavigableSlice } from "./navigable";

/**
 * Expandable — open/closed state for hierarchical nodes (trees, group rows,
 * accordions). Implements the WAI-ARIA tree pattern jointly with Navigable:
 *
 *   ArrowRight on a collapsed parent → expand        (handled here)
 *   ArrowRight on an expanded parent → first child   (handled by Navigable)
 *   ArrowLeft on an expanded parent  → collapse      (handled here)
 *   ArrowLeft on a leaf / collapsed  → parent        (handled by Navigable)
 *
 * The conditions are disjoint, so both behaviors can subscribe to the same
 * intents without coordination.
 */

export interface ExpandableSlice {
  readonly expandedKeys: ReadonlySet<Key>;
}

export interface ExpandableConfig {
  defaultExpandedKeys?: readonly Key[];
}

export const expandIntents = {
  toggle: defineIntent<{ key?: Key }>("expand/toggle"),
  expand: defineIntent<{ key: Key }>("expand/expand"),
  collapse: defineIntent<{ key: Key }>("expand/collapse"),
};

const emitChange = (
  prev: ExpandableSlice,
  expandedKeys: ReadonlySet<Key>,
): TransitionResult<ExpandableSlice> =>
  withEffects({ expandedKeys }, emitEvent({ name: "expandedChange", detail: { expandedKeys } }));

const setExpanded = (
  slice: ExpandableSlice,
  key: Key,
  expanded: boolean,
): TransitionResult<ExpandableSlice> => {
  if (slice.expandedKeys.has(key) === expanded) return slice;
  const next = new Set(slice.expandedKeys);
  if (expanded) next.add(key);
  else next.delete(key);
  return emitChange(slice, next);
};

export const expandable = defineBehavior<
  "expandable",
  ExpandableSlice,
  CollectionBehaviorConfig & ExpandableConfig
>({
  name: "expandable",
  initial: (config) => ({ expandedKeys: new Set(config.defaultExpandedKeys ?? []) }),
  handlers: {
    [expandIntents.toggle.type]: (slice, intent, ctx) => {
      const key =
        (intent.payload as { key?: Key }).key ?? ctx.read<NavigableSlice>("navigable")?.focusedKey;
      if (key === null || key === undefined) return slice;
      const node = ctx.config.getCollection().getNode(key);
      if (!node?.hasChildren) return slice;
      return setExpanded(slice, key, !slice.expandedKeys.has(key));
    },
    [expandIntents.expand.type]: (slice, intent) =>
      setExpanded(slice, (intent.payload as { key: Key }).key, true),
    [expandIntents.collapse.type]: (slice, intent) =>
      setExpanded(slice, (intent.payload as { key: Key }).key, false),

    // Both nav handlers read the *pre-dispatch* focused key: Navigable may
    // already have moved focus during this same dispatch.
    [navIntents.intoChildren.type]: (slice, _intent, ctx) => {
      const key = ctx.readInitial<NavigableSlice>("navigable")?.focusedKey;
      if (key === null || key === undefined) return slice;
      const node = ctx.config.getCollection().getNode(key);
      if (!node?.hasChildren || slice.expandedKeys.has(key)) return slice;
      return setExpanded(slice, key, true);
    },
    [navIntents.toParent.type]: (slice, _intent, ctx) => {
      const key = ctx.readInitial<NavigableSlice>("navigable")?.focusedKey;
      if (key === null || key === undefined) return slice;
      const node = ctx.config.getCollection().getNode(key);
      if (!node?.hasChildren || !slice.expandedKeys.has(key)) return slice;
      return setExpanded(slice, key, false);
    },
  },
  keymap: () => [
    { keys: "ArrowRight", intent: () => navIntents.intoChildren(undefined, "keyboard") },
    { keys: "ArrowLeft", intent: () => navIntents.toParent(undefined, "keyboard") },
  ],
});
