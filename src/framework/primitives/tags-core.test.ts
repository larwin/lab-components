// @vitest-environment node
// TagsInput tested as pure machines: the multiple-selection picker and the
// horizontal chip row (with its input sentinel) — no DOM anywhere.
import { describe, expect, it } from "vitest";
import {
  collectionFromArray,
  composeMachine,
  createStore,
  dismissIntents,
  emitEvent,
  navIntents,
  resolveBinding,
  scrollToItem,
  selectIntents,
  type Collection,
  type DismissableSlice,
  type Key,
  type KeyStroke,
  type NavigableSlice,
  type SelectableSlice,
} from "@/framework/core";
import {
  TAGS_INPUT_KEY,
  chipKeyAfterRemoval,
  chipRemovalBindings,
  tagsFieldBindings,
  tagsPickerBehaviors,
  tagsRowBehaviors,
  tagsRowCollection,
} from "./tags-core";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

const FRUITS = ["Pomme", "Banane", "Cerise", "Datte"];

const makePicker = () => {
  const collection = collectionFromArray(FRUITS, {
    getKey: (f) => f.toLowerCase(),
    getTextValue: (f) => f,
  });
  const composed = composeMachine("tags-picker", tagsPickerBehaviors, {
    getCollection: () => collection as Collection<unknown>,
    selectionMode: "multiple" as const,
    wrap: true,
  });
  const store = createStore(composed.machine);
  const selected = () => [...(store.getState().selectable as SelectableSlice).selectedKeys];
  return { composed, store, selected };
};

const makeRow = (chips: readonly Key[]) => {
  let collection = tagsRowCollection(chips, (k) => k);
  const composed = composeMachine("tags-row", tagsRowBehaviors, {
    getCollection: () => collection as Collection<unknown>,
    orientation: "horizontal" as const,
    wrap: false,
  });
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (resolved) return [...store.dispatch(resolved.intent)];
    return null;
  };
  const focused = () => (store.getState().navigable as NavigableSlice).focusedKey;
  const setChips = (next: readonly Key[]) => {
    collection = tagsRowCollection(next, (k) => k);
  };
  return { composed, store, press, focused, setChips };
};

describe("TagsInput picker — ComboBox machine in multiple mode", () => {
  it("toggle-selects accumulate chips in selection order", () => {
    const { store, selected } = makePicker();
    store.dispatch(selectIntents.select({ key: "banane", toggle: true }, "pointer"));
    store.dispatch(selectIntents.select({ key: "pomme", toggle: true }, "pointer"));
    expect(selected()).toEqual(["banane", "pomme"]);
    // Toggling an already-selected key removes the chip.
    store.dispatch(selectIntents.select({ key: "banane", toggle: true }, "pointer"));
    expect(selected()).toEqual(["pomme"]);
  });

  it("stays open across selections (the host closes it, not the machine)", () => {
    const { store } = makePicker();
    store.dispatch(dismissIntents.open(undefined, "keyboard"));
    store.dispatch(selectIntents.select({ key: "cerise", toggle: true }, "keyboard"));
    expect((store.getState().dismissable as DismissableSlice).open).toBe(true);
  });
});

describe("TagsInput chip row — horizontal Navigable with the input sentinel", () => {
  it("Backspace on an empty field walks from the sentinel to the last chip", () => {
    const { store, focused } = makeRow(["pomme", "banane"]);
    store.dispatch(navIntents.move({ key: TAGS_INPUT_KEY }, "program"));
    const bindings = tagsFieldBindings({ query: "", chipCount: 2 });
    const resolved = resolveBinding(bindings, stroke("Backspace"));
    expect(resolved).not.toBeNull();
    const effects = store.dispatch(resolved!.intent);
    expect(focused()).toBe("banane");
    // The scrollToItem effect is what the adapter reinterprets as DOM focus.
    expect(effects.some((e) => scrollToItem.match(e) && e.payload.key === "banane")).toBe(true);
  });

  it("Backspace falls through while the query is non-empty (text deletion wins)", () => {
    expect(
      resolveBinding(tagsFieldBindings({ query: "po", chipCount: 2 }), stroke("Backspace")),
    ).toBeNull();
    expect(
      resolveBinding(tagsFieldBindings({ query: "", chipCount: 0 }), stroke("Backspace")),
    ).toBeNull();
  });

  it("← → navigate between chips and ArrowRight past the last chip returns to the input", () => {
    const { store, press, focused } = makeRow(["pomme", "banane", "cerise"]);
    store.dispatch(navIntents.move({ key: "banane" }, "program"));
    press(stroke("ArrowLeft"));
    expect(focused()).toBe("pomme");
    press(stroke("ArrowRight"));
    press(stroke("ArrowRight"));
    expect(focused()).toBe("cerise");
    press(stroke("ArrowRight"));
    expect(focused()).toBe(TAGS_INPUT_KEY);
    // No wrap: ArrowRight on the sentinel stays put.
    expect(press(stroke("ArrowRight"))).toEqual([]);
  });

  it("is horizontal: vertical arrows are not bound", () => {
    const { composed, store } = makeRow(["pomme"]);
    expect(resolveBinding(composed.keymap(store.getState()), stroke("ArrowDown"))).toBeNull();
    expect(resolveBinding(composed.keymap(store.getState()), stroke("ArrowUp"))).toBeNull();
  });
});

describe("TagsInput chip removal — a chip is just a selected key", () => {
  it("Backspace/Delete on a chip toggle it off through the picker machine", () => {
    const { store, selected } = makePicker();
    store.dispatch(selectIntents.select({ key: "pomme", toggle: true }, "pointer"));
    store.dispatch(selectIntents.select({ key: "datte", toggle: true }, "pointer"));
    const resolved = resolveBinding(chipRemovalBindings("pomme"), stroke("Backspace"));
    expect(resolved).not.toBeNull();
    const effects = store.dispatch(resolved!.intent);
    expect(selected()).toEqual(["datte"]);
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "selectionChange")).toBe(
      true,
    );
  });

  it("chipKeyAfterRemoval prefers the right neighbour, then the new last, then the input", () => {
    expect(chipKeyAfterRemoval(["a", "b", "c"], "b")).toBe("c");
    expect(chipKeyAfterRemoval(["a", "b", "c"], "c")).toBe("b");
    expect(chipKeyAfterRemoval(["a"], "a")).toBe(TAGS_INPUT_KEY);
    expect(chipKeyAfterRemoval(["a", "b"], "zzz")).toBe(TAGS_INPUT_KEY);
  });
});
