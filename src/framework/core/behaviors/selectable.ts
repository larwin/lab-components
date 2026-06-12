import { defineBehavior, type BehaviorContext, type KeyBinding } from "./behavior";
import { defineIntent, type Intent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";
import { withEffects, type TransitionResult } from "../runtime/machine";
import type { Key } from "../collection/collection";
import {
  EMPTY_SELECTION,
  applySelect,
  clearSelection,
  selectAll,
  type SelectionSnapshot,
} from "../collection/selection";
import { visibleKeysOf, type CollectionBehaviorConfig } from "./collection-config";
import { navIntents, type NavigableSlice } from "./navigable";

/**
 * Selectable — single/multiple selection with anchor + range semantics.
 *
 * Also listens to navigation intents: when `selectionFollowsFocus` is set
 * (single-select listboxes, menus) plain arrows move the selection, and
 * Shift+Arrow extends a range in multiple mode. This works because composed
 * behaviors run as a pipeline — Navigable updates `focusedKey` first, then
 * this handler reads the fresh value through `ctx.read`.
 */

export type SelectableSlice = SelectionSnapshot;

export const selectIntents = {
  select: defineIntent<{ key?: Key; toggle?: boolean; extend?: boolean }>("select/select"),
  all: defineIntent<void>("select/all"),
  clear: defineIntent<void>("select/clear"),
};

const sameSelection = (a: SelectionSnapshot, b: SelectionSnapshot): boolean =>
  a.anchorKey === b.anchorKey &&
  a.selectedKeys.size === b.selectedKeys.size &&
  [...b.selectedKeys].every((k) => a.selectedKeys.has(k));

const emitChange = (
  prev: SelectableSlice,
  next: SelectionSnapshot,
): TransitionResult<SelectableSlice> => {
  if (next === prev || sameSelection(prev, next)) return prev;
  return withEffects(
    next,
    emitEvent({ name: "selectionChange", detail: { selectedKeys: next.selectedKeys } }),
  );
};

type Ctx = BehaviorContext<CollectionBehaviorConfig>;

/** Sync selection after a navigation intent (follow-focus / Shift+Arrow). */
const followNavigation = (
  slice: SelectableSlice,
  intent: Intent<never>,
  ctx: Ctx,
): TransitionResult<SelectableSlice> => {
  const extend =
    (intent.payload as { extend?: boolean } | undefined)?.extend === true &&
    ctx.config.selectionMode === "multiple";
  if (!extend && ctx.config.selectionFollowsFocus !== true) return slice;
  const key = ctx.read<NavigableSlice>("navigable")?.focusedKey;
  if (key === null || key === undefined) return slice;
  const next = applySelect(slice, {
    collection: ctx.config.getCollection(),
    visible: visibleKeysOf(ctx),
    mode: ctx.config.selectionMode ?? "single",
    key,
    extend,
  });
  return emitChange(slice, next);
};

export const selectable = defineBehavior<"selectable", SelectableSlice, CollectionBehaviorConfig>({
  name: "selectable",
  initial: (config) => {
    const keys = config.defaultSelectedKeys;
    if (!keys || keys.length === 0) return EMPTY_SELECTION;
    return { selectedKeys: new Set(keys), anchorKey: keys[0] };
  },
  handlers: {
    [selectIntents.select.type]: (slice, intent, ctx) => {
      const payload = (intent.payload ?? {}) as { key?: Key; toggle?: boolean; extend?: boolean };
      const key = payload.key ?? ctx.read<NavigableSlice>("navigable")?.focusedKey;
      if (key === null || key === undefined) return slice;
      const next = applySelect(slice, {
        collection: ctx.config.getCollection(),
        visible: visibleKeysOf(ctx),
        mode: ctx.config.selectionMode ?? "single",
        key,
        toggle: payload.toggle,
        extend: payload.extend,
      });
      return emitChange(slice, next);
    },
    [selectIntents.all.type]: (slice, _intent, ctx) => {
      if (ctx.config.selectionMode !== "multiple") return slice;
      return emitChange(slice, selectAll(ctx.config.getCollection(), visibleKeysOf(ctx)));
    },
    [selectIntents.clear.type]: (slice) => emitChange(slice, clearSelection(slice)),

    [navIntents.next.type]: followNavigation,
    [navIntents.previous.type]: followNavigation,
    [navIntents.first.type]: followNavigation,
    [navIntents.last.type]: followNavigation,
    [navIntents.page.type]: followNavigation,
  },
  keymap: (_slice, ctx) => {
    const multiple = ctx.config.selectionMode === "multiple";
    const toggleOnSelect = ctx.config.toggleOnSelect === true;
    const bindings: KeyBinding[] = [
      { keys: "Enter", intent: () => selectIntents.select({ toggle: toggleOnSelect }, "keyboard") },
      {
        keys: "Space",
        intent: () => selectIntents.select({ toggle: multiple || toggleOnSelect }, "keyboard"),
      },
    ];
    if (multiple) {
      bindings.push({ keys: "Mod+a", intent: () => selectIntents.all(undefined, "keyboard") });
    }
    return bindings;
  },
  aria: (_slice, ctx) => ({
    "aria-multiselectable": ctx.config.selectionMode === "multiple" || undefined,
  }),
});
