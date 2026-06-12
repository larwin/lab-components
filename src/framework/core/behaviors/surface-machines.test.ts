// @vitest-environment node
// Wave 5: the Splitter is the NumericValue machine yet again (the drag
// machine models items between zones, not a continuous ratio) — pointer drag
// and keyboard arrows converge on the same number/set & increment intents.
import { describe, expect, it } from "vitest";
import { composeMachine } from "./behavior";
import { focusable, focusIntents } from "./focusable";
import { numericValue, numberIntents, type NumericValueSlice } from "./numeric-value";
import { createStore } from "../runtime/store";
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

const makeSplitter = (defaultValue = 50) => {
  const composed = composeMachine(
    "splitter",
    [focusable, numericValue] as const,
    {
      min: 10,
      max: 90,
      step: 1,
      bigStep: 10,
      defaultValue,
      keys: "slider" as const,
      getValueText: (v: number) => `${v} % – ${100 - v} %`,
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

describe("Splitter = Focusable + NumericValue (slider profile)", () => {
  it("arrows resize on both axes (horizontal and vertical splitters share the keymap)", () => {
    const { press, value } = makeSplitter();
    press(stroke("ArrowRight"));
    expect(value()).toBe(51);
    press(stroke("ArrowDown")); // vertical splitter, same machine
    expect(value()).toBe(50);
    press(stroke("Shift+ArrowLeft", { shift: true, key: "ArrowLeft" }));
    expect(value()).toBe(40);
  });

  it("clamps to the min/max panel sizes — keyboard and pointer alike", () => {
    const { press, value, store } = makeSplitter();
    press(stroke("Home"));
    expect(value()).toBe(10);
    press(stroke("ArrowLeft"));
    expect(value()).toBe(10); // saturated
    // Pointer drag far past the edge: same clamp, same intent.
    store.dispatch(numberIntents.set({ value: 250, snap: true }, "pointer"));
    expect(value()).toBe(90);
  });

  it("double-click reset is just number/set back to the default", () => {
    const { value, store } = makeSplitter(30);
    store.dispatch(numberIntents.set({ value: 75 }, "pointer"));
    expect(value()).toBe(75);
    store.dispatch(numberIntents.set({ value: 30 }, "pointer")); // dblclick handler
    expect(value()).toBe(30);
  });

  it("derives the separator ARIA from state", () => {
    const { composed, store } = makeSplitter(42);
    const aria = composed.aria(store.getState());
    expect(aria["aria-valuenow"]).toBe(42);
    expect(aria["aria-valuemin"]).toBe(10);
    expect(aria["aria-valuemax"]).toBe(90);
    expect(aria["aria-valuetext"]).toBe("42 % – 58 %");
  });

  it("disabled splitter ignores both input sources", () => {
    const { press, value, store } = makeSplitter();
    store.dispatch(focusIntents.setDisabled({ disabled: true }, "program"));
    press(stroke("ArrowRight"));
    store.dispatch(numberIntents.set({ value: 80 }, "pointer"));
    expect(value()).toBe(50);
  });
});
