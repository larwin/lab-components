import { defineBehavior, type KeyBinding } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { scrollToItem } from "../runtime/effect";
import { withEffects, type TransitionResult } from "../runtime/machine";
import type { Key } from "../collection/collection";
import { firstKey, lastKey, nextKey, pageKey, previousKey } from "../collection/navigation";
import {
  EMPTY_TYPEAHEAD,
  TYPEAHEAD_TIMEOUT_MS,
  createSearchCollator,
  typeaheadStep,
  type TypeaheadState,
} from "../collection/typeahead";
import {
  visibleKeysOf,
  type CollectionBehaviorConfig,
  type ExpansionReader,
} from "./collection-config";

/**
 * Navigable — keyboard navigation over a collection's visible sequence,
 * including Home/End, PageUp/PageDown, optional wrapping, culture-aware
 * typeahead, and tree-style ArrowRight-into-children / ArrowLeft-to-parent.
 *
 * Focus here is *logical* (a key in state, rendered as aria-activedescendant).
 * The host element keeps DOM focus — which is exactly what makes keyboard
 * navigation work over virtualized collections where the focused item may not
 * even be mounted.
 */

export interface NavigableSlice {
  readonly focusedKey: Key | null;
  readonly typeahead: TypeaheadState;
}

export const navIntents = {
  next: defineIntent<{ extend?: boolean } | void>("nav/next"),
  previous: defineIntent<{ extend?: boolean } | void>("nav/previous"),
  first: defineIntent<{ extend?: boolean } | void>("nav/first"),
  last: defineIntent<{ extend?: boolean } | void>("nav/last"),
  page: defineIntent<{ direction: 1 | -1; size?: number; extend?: boolean }>("nav/page"),
  /** Direct move (pointer hover in menus, programmatic focus). */
  move: defineIntent<{ key: Key }>("nav/move"),
  /** One typeahead character. `now` comes from the input event timestamp. */
  type: defineIntent<{ char: string; now: number }>("nav/type"),
  /** Tree semantics: ArrowRight — handled here (dive) and by Expandable (open). */
  intoChildren: defineIntent<void>("nav/into-children"),
  /** Tree semantics: ArrowLeft — handled here (to parent) and by Expandable (close). */
  toParent: defineIntent<void>("nav/to-parent"),
};

const collators = new Map<string, Intl.Collator>();
const collatorFor = (locale: string): Intl.Collator => {
  let collator = collators.get(locale);
  if (!collator) {
    collator = createSearchCollator(locale);
    collators.set(locale, collator);
  }
  return collator;
};

const moveTo = (slice: NavigableSlice, key: Key | null): TransitionResult<NavigableSlice> => {
  if (key === null || key === slice.focusedKey) return slice;
  return withEffects({ ...slice, focusedKey: key }, scrollToItem({ key }));
};

export const navigable = defineBehavior<"navigable", NavigableSlice, CollectionBehaviorConfig>({
  name: "navigable",
  initial: () => ({ focusedKey: null, typeahead: EMPTY_TYPEAHEAD }),
  handlers: {
    [navIntents.next.type]: (slice, _intent, ctx) => {
      const collection = ctx.config.getCollection();
      const visible = visibleKeysOf(ctx);
      return moveTo(
        slice,
        nextKey(collection, visible, slice.focusedKey, { wrap: ctx.config.wrap }),
      );
    },
    [navIntents.previous.type]: (slice, _intent, ctx) => {
      const collection = ctx.config.getCollection();
      const visible = visibleKeysOf(ctx);
      return moveTo(
        slice,
        previousKey(collection, visible, slice.focusedKey, { wrap: ctx.config.wrap }),
      );
    },
    [navIntents.first.type]: (slice, _intent, ctx) =>
      moveTo(slice, firstKey(ctx.config.getCollection(), visibleKeysOf(ctx))),
    [navIntents.last.type]: (slice, _intent, ctx) =>
      moveTo(slice, lastKey(ctx.config.getCollection(), visibleKeysOf(ctx))),
    [navIntents.page.type]: (slice, intent, ctx) => {
      const { direction, size } = intent.payload as { direction: 1 | -1; size?: number };
      const pageSize = size ?? ctx.config.pageSize ?? 10;
      return moveTo(
        slice,
        pageKey(
          ctx.config.getCollection(),
          visibleKeysOf(ctx),
          slice.focusedKey,
          pageSize,
          direction,
        ),
      );
    },
    [navIntents.move.type]: (slice, intent, ctx) => {
      const { key } = intent.payload as { key: Key };
      const node = ctx.config.getCollection().getNode(key);
      if (!node || node.disabled || node.kind !== "item") return slice;
      return moveTo(slice, key);
    },
    [navIntents.type.type]: (slice, intent, ctx) => {
      const { char, now } = intent.payload as { char: string; now: number };
      const collection = ctx.config.getCollection();
      const { state, matchKey } = typeaheadStep(slice.typeahead, {
        collection,
        visible: visibleKeysOf(ctx),
        focusedKey: slice.focusedKey,
        char,
        now,
        collator: collatorFor(ctx.config.locale ?? "en"),
      });
      const next = { ...slice, typeahead: state };
      if (matchKey === null || matchKey === slice.focusedKey) return next;
      return withEffects({ ...next, focusedKey: matchKey }, scrollToItem({ key: matchKey }));
    },
    [navIntents.intoChildren.type]: (slice, _intent, ctx) => {
      // Only dives when the focused node is already expanded; the collapsed
      // case belongs to Expandable (disjoint conditions, order-independent).
      if (slice.focusedKey === null) return slice;
      const collection = ctx.config.getCollection();
      const node = collection.getNode(slice.focusedKey);
      const expansion = ctx.read<ExpansionReader>("expandable");
      if (!node?.hasChildren || !expansion?.expandedKeys.has(node.key)) return slice;
      const child = node.childKeys.find((k) => {
        const c = collection.getNode(k);
        return c !== undefined && c.kind === "item" && !c.disabled;
      });
      return moveTo(slice, child ?? null);
    },
    [navIntents.toParent.type]: (slice, _intent, ctx) => {
      // Only climbs when the focused node is a leaf or collapsed; collapsing
      // an expanded node belongs to Expandable.
      if (slice.focusedKey === null) return slice;
      const collection = ctx.config.getCollection();
      const node = collection.getNode(slice.focusedKey);
      if (!node || node.parentKey === null) return slice;
      const expansion = ctx.read<ExpansionReader>("expandable");
      if (node.hasChildren && expansion?.expandedKeys.has(node.key)) return slice;
      return moveTo(slice, node.parentKey);
    },
  },
  keymap: (slice, ctx) => {
    const orientation = ctx.config.orientation ?? "vertical";
    const bindings: KeyBinding[] = [];
    if (orientation !== "horizontal") {
      bindings.push(
        { keys: "ArrowDown", intent: () => navIntents.next(undefined, "keyboard") },
        { keys: "ArrowUp", intent: () => navIntents.previous(undefined, "keyboard") },
        { keys: "Shift+ArrowDown", intent: () => navIntents.next({ extend: true }, "keyboard") },
        { keys: "Shift+ArrowUp", intent: () => navIntents.previous({ extend: true }, "keyboard") },
      );
    }
    if (orientation !== "vertical") {
      bindings.push(
        { keys: "ArrowRight", intent: () => navIntents.next(undefined, "keyboard") },
        { keys: "ArrowLeft", intent: () => navIntents.previous(undefined, "keyboard") },
        { keys: "Shift+ArrowRight", intent: () => navIntents.next({ extend: true }, "keyboard") },
        {
          keys: "Shift+ArrowLeft",
          intent: () => navIntents.previous({ extend: true }, "keyboard"),
        },
      );
    }
    bindings.push(
      { keys: "Home", intent: () => navIntents.first(undefined, "keyboard") },
      { keys: "End", intent: () => navIntents.last(undefined, "keyboard") },
      { keys: "PageDown", intent: () => navIntents.page({ direction: 1 }, "keyboard") },
      { keys: "PageUp", intent: () => navIntents.page({ direction: -1 }, "keyboard") },
      {
        keys: "@printable",
        intent: (stroke) => {
          // Space only joins an *active* typeahead search; otherwise it falls
          // through to selection/press bindings declared by later behaviors.
          if (stroke.key === " ") {
            const now = stroke.at ?? 0;
            const active =
              slice.typeahead.buffer !== "" &&
              now - slice.typeahead.lastTypedAt <= TYPEAHEAD_TIMEOUT_MS;
            if (!active) return null;
          }
          return navIntents.type({ char: stroke.key, now: stroke.at ?? 0 }, "keyboard");
        },
      },
    );
    return bindings;
  },
});
