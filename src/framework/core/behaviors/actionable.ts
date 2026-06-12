import { defineBehavior, type KeyBinding } from "./behavior";
import { defineIntent } from "../runtime/intent";
import { emitEvent } from "../runtime/effect";
import { withEffects } from "../runtime/machine";
import type { Key } from "../collection/collection";
import type { CollectionBehaviorConfig } from "./collection-config";
import type { NavigableSlice } from "./navigable";

/**
 * Actionable — "activate the focused item" for menus and command palettes.
 * Unlike Selectable (which models persistent selection state), activation is
 * an event: it emits `event/emit action { key }` and keeps no state. The host
 * typically runs the action and closes the overlay.
 */

export const actionIntents = {
  activate: defineIntent<{ key?: Key } | void>("action/activate"),
};

export const actionable = defineBehavior<
  "actionable",
  Record<string, never>,
  CollectionBehaviorConfig
>({
  name: "actionable",
  initial: () => ({}),
  handlers: {
    [actionIntents.activate.type]: (slice, intent, ctx) => {
      const key =
        (intent.payload as { key?: Key } | undefined)?.key ??
        ctx.read<NavigableSlice>("navigable")?.focusedKey;
      if (key === null || key === undefined) return slice;
      const node = ctx.config.getCollection().getNode(key);
      if (!node || node.disabled || node.kind !== "item") return slice;
      return withEffects(
        slice,
        emitEvent({ name: "action", detail: { key, source: intent.source } }),
      );
    },
  },
  keymap: (): KeyBinding[] => [
    { keys: "Enter", intent: () => actionIntents.activate(undefined, "keyboard") },
    { keys: "Space", intent: () => actionIntents.activate(undefined, "keyboard") },
  ],
});
