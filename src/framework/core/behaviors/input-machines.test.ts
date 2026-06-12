// @vitest-environment node
// Wave 4 input compositions tested as pure machines: SearchField (Searchable
// with the standalone keymap) and Rating (NumericValue, slider profile).
import { describe, expect, it } from "vitest";
import { composeMachine } from "./behavior";
import { focusable } from "./focusable";
import { searchable, searchIntents, type SearchableSlice } from "./searchable";
import { numericValue, numberIntents, type NumericValueSlice } from "./numeric-value";
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

/* ------------------------------------------------------------------ */
/* SearchField = Focusable + Searchable(clearOnEscape, submitOnEnter)  */
/* ------------------------------------------------------------------ */

const makeSearchField = () => {
  const composed = composeMachine("searchfield", [focusable, searchable] as const, {
    clearOnEscape: true,
    submitOnEnter: true,
  });
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (!resolved) return null;
    return [...store.dispatch(resolved.intent)];
  };
  const query = () => (store.getState().searchable as SearchableSlice).query;
  return { composed, store, press, query };
};

describe("SearchField = Focusable + Searchable (standalone keymap)", () => {
  it("Escape clears a non-empty query through the declarative binding", () => {
    const { store, press, query } = makeSearchField();
    store.dispatch(searchIntents.setQuery({ query: "forge" }, "keyboard"));
    const effects = press(stroke("Escape"));
    expect(query()).toBe("");
    expect(effects?.some((e) => emitEvent.match(e) && e.payload.name === "queryChange")).toBe(true);
  });

  it("Escape on an empty field falls through (lets a parent overlay handle it)", () => {
    const { press, query } = makeSearchField();
    expect(press(stroke("Escape"))).toBeNull();
    expect(query()).toBe("");
  });

  it("Enter emits a `search` event carrying the current query", () => {
    const { store, press } = makeSearchField();
    store.dispatch(searchIntents.setQuery({ query: "machines" }, "keyboard"));
    const effects = press(stroke("Enter"));
    const search = effects?.find((e) => emitEvent.match(e) && e.payload.name === "search");
    expect(search).toBeDefined();
    expect((search!.payload as { detail: { query: string } }).detail.query).toBe("machines");
  });

  it("ComboBox-style usage (no flags) binds neither Escape nor Enter", () => {
    const composed = composeMachine("combobox-like", [focusable, searchable] as const, {});
    const store = createStore(composed.machine);
    expect(resolveBinding(composed.keymap(store.getState()), stroke("Escape"))).toBeNull();
    expect(resolveBinding(composed.keymap(store.getState()), stroke("Enter"))).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Rating = Focusable + NumericValue (slider profile, 0..5)            */
/* ------------------------------------------------------------------ */

const makeRating = (step = 1) => {
  const composed = composeMachine(
    "rating",
    [focusable, numericValue] as const,
    {
      min: 0,
      max: 5,
      step,
      defaultValue: 0,
      keys: "slider" as const,
      getValueText: (v: number) => `${v} étoile${v >= 2 ? "s" : ""} sur 5`,
    } as never,
  );
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (resolved) store.dispatch(resolved.intent);
  };
  const value = () => (store.getState().numeric as NumericValueSlice).value;
  return { composed, store, press, value };
};

describe("Rating = Focusable + NumericValue (slider profile) — zero new behavior", () => {
  it("arrows step the rating on both axes, clamped to 0..5", () => {
    const { press, value } = makeRating();
    press(stroke("ArrowRight"));
    press(stroke("ArrowUp"));
    expect(value()).toBe(2);
    press(stroke("ArrowLeft"));
    expect(value()).toBe(1);
    press(stroke("ArrowLeft"));
    press(stroke("ArrowLeft"));
    expect(value()).toBe(0); // saturated at min
  });

  it("Home/End jump to 0 and 5 (slider profile)", () => {
    const { press, value } = makeRating();
    press(stroke("End"));
    expect(value()).toBe(5);
    press(stroke("Home"));
    expect(value()).toBe(0);
  });

  it("half-star steps stay on the 0.5 grid (float-safe)", () => {
    const { press, value, store } = makeRating(0.5);
    store.dispatch(numberIntents.set({ value: 2.5 }, "pointer"));
    press(stroke("ArrowRight"));
    expect(value()).toBe(3);
    store.dispatch(numberIntents.set({ value: 3.7, snap: true }, "pointer"));
    expect(value()).toBe(3.5);
  });

  it("derives aria-valuetext from state — « 3 étoiles sur 5 »", () => {
    const { composed, store } = makeRating();
    store.dispatch(numberIntents.set({ value: 3 }, "pointer"));
    const aria = composed.aria(store.getState());
    expect(aria["aria-valuenow"]).toBe(3);
    expect(aria["aria-valuetext"]).toBe("3 étoiles sur 5");
    expect(aria["aria-valuemin"]).toBe(0);
    expect(aria["aria-valuemax"]).toBe(5);
  });
});
