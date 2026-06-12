// @vitest-environment node
// Pure core: full component machines (Button, Listbox, Tree) tested with
// zero DOM, zero React, zero browser. This is the architecture's proof.
import { describe, expect, it } from "vitest";
import { composeMachine } from "./behavior";
import { focusable, focusIntents } from "./focusable";
import { pressable, pressIntents } from "./pressable";
import { toggleable, toggleIntents } from "./toggleable";
import { navigable, navIntents, type NavigableSlice } from "./navigable";
import { selectable, selectIntents, type SelectableSlice } from "./selectable";
import { expandable, expandIntents, type ExpandableSlice } from "./expandable";
import type { CollectionBehaviorConfig } from "./collection-config";
import { createCollection, collectionFromArray } from "../collection/collection";
import { createStore } from "../runtime/store";
import { emitEvent } from "../runtime/effect";
import { resolveBinding } from "../interaction/keymap";
import type { KeyStroke } from "../interaction/keys";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

describe("Button = Focusable + Pressable", () => {
  const make = (disabled = false) =>
    composeMachine("button", [focusable, pressable] as const, { disabled });

  it("emits a press event effect on activation — the callback lives at the edge", () => {
    const { machine } = make();
    const store = createStore(machine);
    const effects = store.dispatch(pressIntents.activate(undefined, "shortcut"));
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "press")).toBe(true);
  });

  it("press start/end cycle tracks pressed state and fires once", () => {
    const { machine } = make();
    const store = createStore(machine);
    store.dispatch(pressIntents.start(undefined, "pointer"));
    expect(store.getState().pressable.pressed).toBe(true);
    const effects = store.dispatch(pressIntents.end(undefined, "pointer"));
    expect(effects).toHaveLength(1);
    expect(store.getState().pressable.pressed).toBe(false);
    // end without start → no event
    expect(store.dispatch(pressIntents.end(undefined, "pointer"))).toHaveLength(0);
  });

  it("disabled blocks activation and focus", () => {
    const { machine } = make(true);
    const store = createStore(machine);
    expect(store.dispatch(pressIntents.activate(undefined, "pointer"))).toHaveLength(0);
    store.dispatch(focusIntents.focus({}, "pointer"));
    expect(store.getState().focusable.focused).toBe(false);
  });

  it("activates from the declarative keymap (Enter / Space)", () => {
    const composed = make();
    const store = createStore(composed.machine);
    const resolved = resolveBinding(composed.keymap(store.getState()), stroke("Enter"));
    expect(resolved).not.toBeNull();
    const effects = store.dispatch(resolved!.intent);
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "press")).toBe(true);
  });
});

describe("Checkbox = Focusable + Toggleable", () => {
  it("cycles unchecked → checked and resolves mixed → checked", () => {
    const { machine } = composeMachine("checkbox", [focusable, toggleable] as const, {
      defaultChecked: "mixed" as const,
    });
    const store = createStore(machine);
    store.dispatch(toggleIntents.toggle(undefined, "pointer"));
    expect(store.getState().toggleable.checked).toBe(true);
    store.dispatch(toggleIntents.toggle(undefined, "pointer"));
    expect(store.getState().toggleable.checked).toBe(false);
  });

  it("derives aria-checked from state", () => {
    const composed = composeMachine("checkbox", [focusable, toggleable] as const, {});
    const store = createStore(composed.machine);
    expect(composed.aria(store.getState())["aria-checked"]).toBe(false);
    store.dispatch(toggleIntents.toggle(undefined, "pointer"));
    expect(composed.aria(store.getState())["aria-checked"]).toBe(true);
  });
});

const makeListbox = (mode: "single" | "multiple", followFocus = false) => {
  const collection = collectionFromArray(["Alpha", "Bravo", "Charlie", "Delta"], {
    getKey: (s) => s,
    getTextValue: (s) => s,
  });
  const config: CollectionBehaviorConfig = {
    getCollection: () => collection,
    selectionMode: mode,
    selectionFollowsFocus: followFocus,
  };
  const composed = composeMachine("listbox", [focusable, navigable, selectable] as const, config);
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (resolved) store.dispatch(resolved.intent);
    return resolved;
  };
  return { composed, store, press };
};

describe("Listbox = Focusable + Navigable + Selectable", () => {
  it("navigates with arrows, Home and End through the keymap", () => {
    const { store, press } = makeListbox("single");
    press(stroke("ArrowDown"));
    expect((store.getState().navigable as NavigableSlice).focusedKey).toBe("Alpha");
    press(stroke("ArrowDown"));
    press(stroke("ArrowDown"));
    expect((store.getState().navigable as NavigableSlice).focusedKey).toBe("Charlie");
    press(stroke("End"));
    expect((store.getState().navigable as NavigableSlice).focusedKey).toBe("Delta");
    press(stroke("Home"));
    expect((store.getState().navigable as NavigableSlice).focusedKey).toBe("Alpha");
  });

  it("selection follows focus in single mode when configured", () => {
    const { store, press } = makeListbox("single", true);
    press(stroke("ArrowDown"));
    press(stroke("ArrowDown"));
    const selection = store.getState().selectable as SelectableSlice;
    expect([...selection.selectedKeys]).toEqual(["Bravo"]);
  });

  it("Shift+Arrow extends a range in multiple mode", () => {
    const { store, press } = makeListbox("multiple");
    press(stroke("ArrowDown")); // focus Alpha
    store.dispatch(selectIntents.select({}, "keyboard")); // anchor Alpha
    press(stroke("ArrowDown", { shift: true }));
    press(stroke("ArrowDown", { shift: true }));
    const selection = store.getState().selectable as SelectableSlice;
    expect([...selection.selectedKeys]).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("typeahead focuses by prefix via the @printable binding", () => {
    const { store, press } = makeListbox("single");
    press(stroke("c", { at: 10 }));
    expect((store.getState().navigable as NavigableSlice).focusedKey).toBe("Charlie");
  });

  it("Space falls through typeahead to selection when no search is active", () => {
    const { store, press } = makeListbox("multiple");
    press(stroke("ArrowDown"));
    const resolved = press(stroke(" ", { at: 5000 }));
    expect(resolved?.intent.type).toBe(selectIntents.select.type);
    expect((store.getState().selectable as SelectableSlice).selectedKeys.has("Alpha")).toBe(true);
  });
});

describe("Tree = Listbox + Expandable (ARIA tree pattern)", () => {
  const make = () => {
    const collection = createCollection([
      {
        key: "a",
        value: "A",
        children: [
          { key: "a1", value: "A1" },
          { key: "a2", value: "A2" },
        ],
      },
      { key: "b", value: "B" },
    ]);
    const config: CollectionBehaviorConfig = { getCollection: () => collection };
    const composed = composeMachine(
      "tree",
      [focusable, navigable, expandable, selectable] as const,
      config,
    );
    const store = createStore(composed.machine);
    const press = (s: KeyStroke) => {
      const resolved = resolveBinding(composed.keymap(store.getState()), s);
      if (resolved) store.dispatch(resolved.intent);
    };
    return { store, press };
  };

  const nav = (store: { getState(): Record<string, unknown> }) =>
    store.getState().navigable as NavigableSlice;
  const exp = (store: { getState(): Record<string, unknown> }) =>
    store.getState().expandable as ExpandableSlice;

  it("ArrowRight expands a collapsed parent, then dives into children", () => {
    const { store, press } = make();
    press(stroke("ArrowDown")); // focus "a"
    press(stroke("ArrowRight")); // expand
    expect(exp(store).expandedKeys.has("a")).toBe(true);
    expect(nav(store).focusedKey).toBe("a"); // focus did not move yet
    press(stroke("ArrowRight")); // dive
    expect(nav(store).focusedKey).toBe("a1");
  });

  it("ArrowLeft climbs from a leaf WITHOUT collapsing the parent", () => {
    const { store, press } = make();
    press(stroke("ArrowDown"));
    press(stroke("ArrowRight"));
    press(stroke("ArrowRight")); // at a1
    press(stroke("ArrowLeft")); // climb to "a"
    expect(nav(store).focusedKey).toBe("a");
    expect(exp(store).expandedKeys.has("a")).toBe(true); // still expanded
    press(stroke("ArrowLeft")); // now collapse
    expect(exp(store).expandedKeys.has("a")).toBe(false);
    expect(nav(store).focusedKey).toBe("a");
  });

  it("collapsed children are not navigable", () => {
    const { store, press } = make();
    press(stroke("ArrowDown")); // a
    press(stroke("ArrowDown")); // b (a1/a2 hidden)
    expect(nav(store).focusedKey).toBe("b");
  });

  it("expand/toggle without explicit key targets the focused node", () => {
    const { store, press } = make();
    press(stroke("ArrowDown"));
    store.dispatch(expandIntents.toggle({}, "program"));
    expect(exp(store).expandedKeys.has("a")).toBe(true);
  });
});
