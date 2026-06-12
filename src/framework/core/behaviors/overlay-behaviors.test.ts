// @vitest-environment node
// Pure core: a full menu-style machine (search + navigate + activate +
// dismiss) tested without DOM, React or browser.
import { describe, expect, it } from "vitest";
import { composeMachine } from "./behavior";
import { focusable } from "./focusable";
import { navigable, navIntents, type NavigableSlice } from "./navigable";
import { actionable, actionIntents } from "./actionable";
import { searchable, searchIntents, type SearchableSlice } from "./searchable";
import { dismissable, dismissIntents, type DismissableSlice } from "./dismissable";
import type { CollectionBehaviorConfig } from "./collection-config";
import { collectionFromArray } from "../collection/collection";
import { createStore } from "../runtime/store";
import { emitEvent, restoreFocus } from "../runtime/effect";
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

const make = () => {
  const collection = collectionFromArray(
    [
      { key: "copy", label: "Copy" },
      { key: "paste", label: "Paste", disabled: true },
      { key: "delete", label: "Delete" },
    ],
    {
      getKey: (c) => c.key,
      getTextValue: (c) => c.label,
      isDisabled: (c) => c.disabled === true,
    },
  );
  const config: CollectionBehaviorConfig = { getCollection: () => collection, wrap: true };
  const composed = composeMachine(
    "menu",
    [focusable, searchable, navigable, actionable, dismissable] as const,
    config,
  );
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (resolved) return store.dispatch(resolved.intent);
    return [];
  };
  return { composed, store, press };
};

describe("Menu machine = Focusable + Searchable + Navigable + Actionable + Dismissable", () => {
  it("activating the focused item emits an action event with the key", () => {
    const { store, press } = make();
    store.dispatch(dismissIntents.open(undefined, "pointer"));
    store.dispatch(navIntents.first(undefined, "pointer"));
    const effects = press(stroke("Enter"));
    const action = effects.find((e) => emitEvent.match(e) && e.payload.name === "action");
    expect(action).toBeDefined();
    expect((action!.payload as { detail: { key: string } }).detail.key).toBe("copy");
  });

  it("never activates disabled items", () => {
    const { store } = make();
    const effects = store.dispatch(actionIntents.activate({ key: "paste" }, "pointer"));
    expect(effects).toHaveLength(0);
  });

  it("navigation skips disabled items and wraps", () => {
    const { store } = make();
    store.dispatch(navIntents.first(undefined, "keyboard"));
    store.dispatch(navIntents.next(undefined, "keyboard"));
    expect((store.getState().navigable as NavigableSlice).focusedKey).toBe("delete");
    store.dispatch(navIntents.next(undefined, "keyboard"));
    expect((store.getState().navigable as NavigableSlice).focusedKey).toBe("copy"); // wrapped
  });

  it("Escape closes only when open, requesting focus restore", () => {
    const { store, press } = make();
    expect(press(stroke("Escape"))).toHaveLength(0); // closed → not bound
    store.dispatch(dismissIntents.open(undefined, "pointer"));
    const effects = press(stroke("Escape"));
    expect((store.getState().dismissable as DismissableSlice).open).toBe(false);
    expect(effects.some((e) => restoreFocus.match(e))).toBe(true);
    const openChange = effects.find((e) => emitEvent.match(e) && e.payload.name === "openChange");
    expect((openChange!.payload as { detail: { reason: string } }).detail.reason).toBe("escape");
  });

  it("the query is machine state and emits change events", () => {
    const { store } = make();
    const effects = store.dispatch(searchIntents.setQuery({ query: "co" }, "keyboard"));
    expect((store.getState().searchable as SearchableSlice).query).toBe("co");
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "queryChange")).toBe(true);
    // idempotent
    expect(store.dispatch(searchIntents.setQuery({ query: "co" }, "keyboard"))).toHaveLength(0);
  });
});
