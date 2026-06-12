// @vitest-environment node
// Wave 2 navigation & disclosure: Tabs, Accordion and Select tested as pure
// composed machines — the React shells render these exact states.
import { describe, expect, it } from "vitest";
import { composeMachine } from "./behavior";
import { focusable } from "./focusable";
import { navigable, navIntents, type NavigableSlice } from "./navigable";
import { selectable, selectIntents, type SelectableSlice } from "./selectable";
import { expandable, expandIntents, type ExpandableSlice } from "./expandable";
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

/* ------------------------------------------------------------------ */
/* Tabs = Focusable + Navigable(horizontal) + Selectable               */
/* ------------------------------------------------------------------ */

const makeTabs = (activation: "automatic" | "manual") => {
  const collection = collectionFromArray(["general", "billing", "team"], {
    getKey: (s) => s,
    getTextValue: (s) => s,
  });
  const config: CollectionBehaviorConfig = {
    getCollection: () => collection,
    selectionMode: "single",
    selectionFollowsFocus: activation === "automatic",
    orientation: "horizontal",
    wrap: true,
    defaultSelectedKeys: ["general"],
  };
  const composed = composeMachine("tabs", [focusable, navigable, selectable] as const, config);
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (resolved) store.dispatch(resolved.intent);
  };
  const selected = () => [...(store.getState().selectable as SelectableSlice).selectedKeys][0];
  const focused = () => (store.getState().navigable as NavigableSlice).focusedKey;
  return { store, press, selected, focused };
};

describe("Tabs machine — automatic vs manual activation", () => {
  it("automatic: ArrowRight moves focus AND activates the tab", () => {
    const { press, selected, focused } = makeTabs("automatic");
    press(stroke("ArrowRight")); // enters on first item
    press(stroke("ArrowRight"));
    expect(focused()).toBe("billing");
    expect(selected()).toBe("billing");
  });

  it("manual: arrows only move focus; Enter/Space activates", () => {
    const { press, selected, focused } = makeTabs("manual");
    press(stroke("ArrowRight"));
    press(stroke("ArrowRight"));
    expect(focused()).toBe("billing");
    expect(selected()).toBe("general"); // unchanged
    press(stroke("Enter"));
    expect(selected()).toBe("billing");
  });

  it("wraps from the last tab to the first", () => {
    const { store, press, focused } = makeTabs("manual");
    store.dispatch(navIntents.move({ key: "team" }, "program"));
    press(stroke("ArrowRight"));
    expect(focused()).toBe("general");
  });
});

/* ------------------------------------------------------------------ */
/* Accordion = Focusable + Navigable + Expandable(single|multiple)     */
/* ------------------------------------------------------------------ */

const makeAccordion = (mode: "single" | "multiple") => {
  const collection = collectionFromArray(["shipping", "returns", "warranty"], {
    getKey: (s) => s,
    getTextValue: (s) => s,
  });
  const config: CollectionBehaviorConfig & { expansionMode: "single" | "multiple" } = {
    getCollection: () => collection,
    expansionMode: mode,
  };
  const composed = composeMachine("accordion", [focusable, navigable, expandable] as const, config);
  const store = createStore(composed.machine);
  const expanded = () => [...(store.getState().expandable as ExpandableSlice).expandedKeys];
  return { store, expanded };
};

describe("Accordion machine — expansion modes", () => {
  it("single mode: opening a section closes the previous one", () => {
    const { store, expanded } = makeAccordion("single");
    store.dispatch(expandIntents.expand({ key: "shipping" }, "pointer"));
    expect(expanded()).toEqual(["shipping"]);
    store.dispatch(expandIntents.expand({ key: "returns" }, "pointer"));
    expect(expanded()).toEqual(["returns"]);
    store.dispatch(expandIntents.collapse({ key: "returns" }, "pointer"));
    expect(expanded()).toEqual([]);
  });

  it("multiple mode: sections open independently", () => {
    const { store, expanded } = makeAccordion("multiple");
    store.dispatch(expandIntents.expand({ key: "shipping" }, "pointer"));
    store.dispatch(expandIntents.expand({ key: "warranty" }, "pointer"));
    expect(expanded()).toEqual(["shipping", "warranty"]);
  });

  it("emits expandedChange with the new key set", () => {
    const { store } = makeAccordion("single");
    const effects = store.dispatch(expandIntents.expand({ key: "shipping" }, "pointer"));
    const event = effects.find((e) => emitEvent.match(e) && e.payload.name === "expandedChange");
    expect(event).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* Select = Focusable + Navigable + Selectable + Dismissable           */
/* ------------------------------------------------------------------ */

const makeSelect = () => {
  const collection = collectionFromArray(["Belgique", "Brésil", "Canada", "France"], {
    getKey: (s) => s,
    getTextValue: (s) => s,
  });
  const config: CollectionBehaviorConfig = {
    getCollection: () => collection,
    selectionMode: "single",
    wrap: true,
    defaultSelectedKeys: ["Canada"],
  };
  const composed = composeMachine(
    "select",
    [focusable, navigable, selectable, dismissable] as const,
    config,
  );
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (resolved) return store.dispatch(resolved.intent);
    return [];
  };
  const open = () => (store.getState().dismissable as DismissableSlice).open;
  const selected = () => [...(store.getState().selectable as SelectableSlice).selectedKeys][0];
  const focused = () => (store.getState().navigable as NavigableSlice).focusedKey;
  return { store, press, open, selected, focused };
};

describe("Select machine — dropdown listbox over Dismissable", () => {
  it("open + navigate + Enter: selects and the shell closes on selectionChange", () => {
    const { store, press, selected } = makeSelect();
    store.dispatch(dismissIntents.open(undefined, "pointer"));
    store.dispatch(navIntents.move({ key: "Canada" }, "program")); // focus the current value
    press(stroke("ArrowDown"));
    const effects = press(stroke("Enter"));
    expect(selected()).toBe("France");
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "selectionChange")).toBe(
      true,
    );
  });

  it("typeahead jumps to the matching option while open", () => {
    const { store, press, focused } = makeSelect();
    store.dispatch(dismissIntents.open(undefined, "keyboard"));
    press(stroke("b", { at: 10 }));
    expect(focused()).toBe("Belgique");
    press(stroke("r", { at: 50 })); // still within the typeahead window: "br"
    expect(focused()).toBe("Brésil");
  });

  it("Escape closes and restores focus to the trigger (declarative effect)", () => {
    const { press, open, store } = makeSelect();
    store.dispatch(dismissIntents.open(undefined, "keyboard"));
    expect(open()).toBe(true);
    const effects = press(stroke("Escape"));
    expect(open()).toBe(false);
    expect(effects.some((e) => restoreFocus.match(e))).toBe(true);
  });

  it("selection survives close/reopen (the value is the state)", () => {
    const { store, press, selected, open } = makeSelect();
    store.dispatch(dismissIntents.open(undefined, "pointer"));
    store.dispatch(selectIntents.select({ key: "France" }, "pointer"));
    store.dispatch(dismissIntents.close({ reason: "select" }, "program"));
    expect(open()).toBe(false);
    store.dispatch(dismissIntents.open(undefined, "pointer"));
    expect(selected()).toBe("France");
    press(stroke("Escape"));
  });
});
