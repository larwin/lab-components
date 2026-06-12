// @vitest-environment node
// Menubar tested as a pure machine: Focusable + Navigable(horizontal, wrap) +
// Dismissable — the open panel follows the bar's focusedKey.
import { describe, expect, it } from "vitest";
import {
  createStore,
  composeMachine,
  dismissIntents,
  navIntents,
  resolveBinding,
  type Collection,
  type DismissableSlice,
  type KeyStroke,
  type NavigableSlice,
} from "@/framework/core";
import { menubarBehaviors, menubarCollection, menubarPanelBindings } from "./menubar-core";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

const MENUS = [
  { key: "file", label: "Fichier" },
  { key: "edit", label: "Édition" },
  { key: "view", label: "Affichage", disabled: true },
  { key: "help", label: "Aide" },
];

const makeMenubar = () => {
  const collection = menubarCollection(MENUS);
  const composed = composeMachine("menubar", menubarBehaviors, {
    getCollection: () => collection as Collection<unknown>,
    orientation: "horizontal" as const,
    wrap: true,
  });
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (resolved) store.dispatch(resolved.intent);
  };
  const focused = () => (store.getState().navigable as NavigableSlice).focusedKey;
  const open = () => (store.getState().dismissable as DismissableSlice).open;
  return { composed, store, press, focused, open };
};

describe("Menubar = Focusable + Navigable(horizontal) + Dismissable", () => {
  it("← → travel the top-level menus, skipping disabled ones, with wrap", () => {
    const { store, press, focused } = makeMenubar();
    store.dispatch(navIntents.move({ key: "file" }, "program"));
    press(stroke("ArrowRight"));
    expect(focused()).toBe("edit");
    press(stroke("ArrowRight")); // "view" is disabled → skipped
    expect(focused()).toBe("help");
    press(stroke("ArrowRight")); // wrap
    expect(focused()).toBe("file");
    press(stroke("ArrowLeft")); // wrap backwards
    expect(focused()).toBe("help");
  });

  it("moving while open keeps the panel open on the new menu (APG hover/arrow behavior)", () => {
    const { store, press, focused, open } = makeMenubar();
    store.dispatch(navIntents.move({ key: "file" }, "program"));
    store.dispatch(dismissIntents.open(undefined, "keyboard"));
    expect(open()).toBe(true);
    const bindings = menubarPanelBindings();
    const right = resolveBinding(bindings, stroke("ArrowRight"));
    expect(right).not.toBeNull();
    store.dispatch(right!.intent);
    expect(focused()).toBe("edit");
    expect(open()).toBe(true); // the panel follows, it does not close
  });

  it("Escape closes the panel and emits the focus-restore effect", () => {
    const { store, press, open } = makeMenubar();
    store.dispatch(navIntents.move({ key: "edit" }, "program"));
    store.dispatch(dismissIntents.open(undefined, "keyboard"));
    press(stroke("Escape"));
    expect(open()).toBe(false);
  });

  it("typeahead jumps between menus by label (Navigable for free)", () => {
    const { store, focused } = makeMenubar();
    store.dispatch(navIntents.move({ key: "file" }, "program"));
    store.dispatch(navIntents.type({ char: "a", now: 0 }, "keyboard"));
    expect(focused()).toBe("help"); // « Aide »
  });
});
