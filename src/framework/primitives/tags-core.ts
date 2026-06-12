import {
  collectionFromArray,
  dismissable,
  focusable,
  navigable,
  navIntents,
  searchable,
  selectable,
  selectIntents,
  type Collection,
  type Key,
  type KeyBinding,
} from "@/framework/core";

/**
 * Shared machine recipe for TagsInput / MultiSelect — pure composition, no
 * React (same role as menu-core for menus).
 *
 * Two machines cooperate:
 *  - the picker: Searchable + Navigable + Selectable(multiple) + Dismissable —
 *    exactly ComboBox, in multiple mode;
 *  - the chip row: a second Navigable in *horizontal* orientation over the
 *    selected keys **plus a sentinel node standing for the text input**.
 *
 * The sentinel is the trick that keeps everything declarative: while the
 * input has DOM focus the row's focusedKey is the sentinel, so "Backspace on
 * an empty field focuses the last chip" is plain `nav/previous`, and
 * "ArrowRight past the last chip returns to the input" is plain `nav/next`.
 * The adapter reinterprets the row's `scrollToItem` effect as DOM focus
 * (chips are real buttons, like Accordion headers).
 */

export const tagsPickerBehaviors = [
  focusable,
  searchable,
  navigable,
  selectable,
  dismissable,
] as const;

export const tagsRowBehaviors = [navigable] as const;

/** Collection key standing for the text input inside the chip row. */
export const TAGS_INPUT_KEY = "__tags-input";

/** The chip row collection: one node per selected key + the input sentinel. */
export function tagsRowCollection(
  chipKeys: readonly Key[],
  getTextValue: (key: Key) => string,
): Collection<Key> {
  return collectionFromArray([...chipKeys, TAGS_INPUT_KEY], {
    getKey: (key) => key,
    getTextValue: (key) => (key === TAGS_INPUT_KEY ? "" : getTextValue(key)),
  });
}

/**
 * Extra bindings for the text input, resolved *before* the picker keymap and
 * dispatched to the chip-row machine. Both fall through (`null`) while the
 * query is non-empty: Backspace then deletes text and ArrowLeft moves the
 * caret, as a text field should.
 */
export function tagsFieldBindings(opts: { query: string; chipCount: number }): KeyBinding[] {
  const chipsReachable = opts.query === "" && opts.chipCount > 0;
  return [
    {
      keys: "Backspace",
      intent: () => (chipsReachable ? navIntents.previous(undefined, "keyboard") : null),
      preventDefault: false,
    },
    {
      keys: "ArrowLeft",
      intent: () => (chipsReachable ? navIntents.previous(undefined, "keyboard") : null),
    },
  ];
}

/**
 * Removal bindings for a focused chip, dispatched to the *picker* machine
 * (a chip is just a selected key — removing it is `select/select` toggle).
 */
export function chipRemovalBindings(key: Key): KeyBinding[] {
  return [
    { keys: "Backspace", intent: () => selectIntents.select({ key, toggle: true }, "keyboard") },
    { keys: "Delete", intent: () => selectIntents.select({ key, toggle: true }, "keyboard") },
  ];
}

/**
 * Where DOM focus lands after removing a chip from the keyboard: the next
 * chip to the right, else the new last chip, else the input sentinel.
 */
export function chipKeyAfterRemoval(chipKeys: readonly Key[], removedKey: Key): Key {
  const index = chipKeys.indexOf(removedKey);
  if (index === -1) return TAGS_INPUT_KEY;
  const remaining = chipKeys.filter((k) => k !== removedKey);
  if (remaining.length === 0) return TAGS_INPUT_KEY;
  return remaining[Math.min(index, remaining.length - 1)];
}
