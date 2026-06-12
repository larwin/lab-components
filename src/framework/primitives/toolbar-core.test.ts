// @vitest-environment node
// Wave 9a — the toolbar as a pure machine: the bar is [Focusable +
// Navigable(horizontal, wrap)] over a flattened collection (toggle groups
// contribute their toggles as toolbar stops, separators are skipped),
// disabled controls stay reachable, RTL flips the strokes at the adapter
// boundary, and the overflow menu is a pure projection of the defs.
import { describe, expect, it } from "vitest";
import {
  composeMachine,
  createStore,
  flipHorizontalStroke,
  navIntents,
  resolveBinding,
  scrollToItem,
  type Effect,
  type KeyStroke,
  type NavigableSlice,
} from "@/framework/core";
import {
  OVERFLOW_TRIGGER_KEY,
  overflowMenuSections,
  toolbarBehaviors,
  toolbarCollection,
  toolbarOverflowItems,
  type ToolbarItemDef,
} from "./toolbar-core";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

const DEFS: ToolbarItemDef[] = [
  { kind: "button", key: "undo", label: "Annuler", disabled: true },
  { kind: "button", key: "redo", label: "Rétablir", shortcut: "Mod+Shift+Z" },
  { kind: "separator", key: "sep-1" },
  {
    kind: "toggle-group",
    key: "format",
    label: "Format",
    mode: "multiple",
    items: [
      { key: "bold", label: "Gras", shortcut: "Mod+B" },
      { key: "italic", label: "Italique", shortcut: "Mod+I" },
    ],
  },
  { kind: "separator", key: "sep-2" },
  {
    kind: "select",
    key: "size",
    label: "Taille",
    options: [
      { key: "12", label: "12 px" },
      { key: "14", label: "14 px" },
      { key: "16", label: "16 px" },
    ],
  },
];

const makeToolbar = (
  defs: ToolbarItemDef[] = DEFS,
  overflow: ReadonlySet<string> = new Set(),
  direction: "ltr" | "rtl" = "ltr",
) => {
  const collection = toolbarCollection(defs, overflow, overflow.size > 0);
  const composed = composeMachine("toolbar", toolbarBehaviors, {
    getCollection: () => collection,
    orientation: "horizontal" as const,
    wrap: true,
  });
  const store = createStore(composed.machine);
  const effects: Effect[] = [];
  store.onEffect((e) => effects.push(e));
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(
      composed.keymap(store.getState()),
      flipHorizontalStroke(s, direction),
    );
    if (resolved) store.dispatch(resolved.intent);
  };
  const focused = () => (store.getState().navigable as NavigableSlice).focusedKey;
  return { collection, store, press, focused, effects };
};

describe("toolbar collection — flattening", () => {
  it("flattens toggle groups into toolbar stops and skips separators", () => {
    const { store, press, focused } = makeToolbar();
    store.dispatch(navIntents.first(undefined, "keyboard"));
    expect(focused()).toBe("undo");
    press(stroke("ArrowRight"));
    expect(focused()).toBe("redo");
    press(stroke("ArrowRight")); // separator skipped → into the toggle group
    expect(focused()).toBe("bold");
    press(stroke("ArrowRight"));
    expect(focused()).toBe("italic");
    press(stroke("ArrowRight")); // out of the group, past the separator
    expect(focused()).toBe("size");
  });

  it("keeps disabled controls reachable (APG: no navigation hole)", () => {
    const { store, press, focused } = makeToolbar();
    store.dispatch(navIntents.move({ key: "redo" }, "program"));
    press(stroke("ArrowLeft"));
    expect(focused()).toBe("undo"); // disabled but focusable
  });

  it("wraps at both edges and supports Home/End", () => {
    const { store, press, focused } = makeToolbar();
    store.dispatch(navIntents.first(undefined, "keyboard"));
    press(stroke("ArrowLeft"));
    expect(focused()).toBe("size"); // wrap backwards
    press(stroke("ArrowRight"));
    expect(focused()).toBe("undo"); // wrap forwards
    press(stroke("End"));
    expect(focused()).toBe("size");
    press(stroke("Home"));
    expect(focused()).toBe("undo");
  });

  it("excludes overflowed defs and appends the trigger as a real stop", () => {
    const { collection, store, press, focused } = makeToolbar(DEFS, new Set(["size", "format"]));
    expect(collection.getNode("size")).toBeUndefined();
    expect(collection.getNode("bold")).toBeUndefined();
    expect(collection.getNode(OVERFLOW_TRIGGER_KEY)).toBeDefined();
    store.dispatch(navIntents.last(undefined, "keyboard"));
    expect(focused()).toBe(OVERFLOW_TRIGGER_KEY);
    press(stroke("ArrowLeft"));
    expect(focused()).toBe("redo");
  });

  it("emits scrollToItem on every move (reinterpreted as DOM focus)", () => {
    const { store, press, effects } = makeToolbar();
    store.dispatch(navIntents.first(undefined, "keyboard"));
    press(stroke("ArrowRight"));
    const moves = effects.filter((e) => scrollToItem.match(e));
    expect(moves.map((e) => (e.payload as { key: string }).key)).toEqual(["undo", "redo"]);
  });
});

describe("toolbar RTL — strokes flip at the adapter boundary", () => {
  it("ArrowLeft advances in RTL (visual forward), ArrowRight goes back", () => {
    const { store, press, focused } = makeToolbar(DEFS, new Set(), "rtl");
    store.dispatch(navIntents.first(undefined, "keyboard"));
    press(stroke("ArrowLeft"));
    expect(focused()).toBe("redo");
    press(stroke("ArrowRight"));
    expect(focused()).toBe("undo");
  });
});

describe("overflow menu projection", () => {
  it("projects overflowed defs onto sections, values as selected flags", () => {
    const values = new Map<string, readonly string[]>([
      ["format", ["bold"]],
      ["size", ["14"]],
    ]);
    const sections = overflowMenuSections(DEFS, new Set(["redo", "format", "size"]), values);
    expect(sections).toHaveLength(3);

    expect(sections[0].label).toBeUndefined();
    expect(sections[0].entries.map((e) => e.menuKey)).toEqual(["redo"]);
    expect(sections[0].entries[0].shortcut).toBe("Mod+Shift+Z");

    expect(sections[1].label).toBe("Format");
    expect(sections[1].entries.map((e) => [e.menuKey, e.selected])).toEqual([
      ["bold", true],
      ["italic", false],
    ]);

    expect(sections[2].label).toBe("Taille");
    // Options are namespaced so two selects can share option keys.
    expect(sections[2].entries.map((e) => e.menuKey)).toEqual(["size::12", "size::14", "size::16"]);
    expect(sections[2].entries[1].selected).toBe(true);
    expect(sections[2].entries[1].itemKey).toBe("14");
    expect(sections[2].entries[1].defKey).toBe("size");
  });

  it("only projects defs that actually overflowed, in document order", () => {
    const sections = overflowMenuSections(DEFS, new Set(["undo"]), new Map());
    expect(sections).toHaveLength(1);
    expect(sections[0].entries.map((e) => e.menuKey)).toEqual(["undo"]);
    expect(sections[0].entries[0].disabled).toBe(true);
  });

  it("maps defs to measurable overflow items (separator kind, priorities)", () => {
    const defs: ToolbarItemDef[] = [
      { kind: "button", key: "a", label: "A", overflowPriority: 2 },
      { kind: "separator", key: "s" },
      { kind: "button", key: "b", label: "B" },
    ];
    const items = toolbarOverflowItems(defs, (key) => (key === "s" ? 9 : 40));
    expect(items).toEqual([
      { key: "a", width: 40, priority: 2, kind: "item" },
      { key: "s", width: 9, priority: undefined, kind: "separator" },
      { key: "b", width: 40, priority: undefined, kind: "item" },
    ]);
  });
});
