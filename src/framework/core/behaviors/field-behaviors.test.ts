// @vitest-environment node
// Wave 1 form controls: NumberField, Slider, RadioGroup and validation tested
// as pure machines — intents in, state + effects out, no DOM anywhere.
import { describe, expect, it } from "vitest";
import { composeMachine } from "./behavior";
import { focusable, focusIntents } from "./focusable";
import { numericValue, numberIntents, type NumericValueSlice } from "./numeric-value";
import { validatable, validityIntents, type ValidatableSlice } from "./validatable";
import { navigable, type NavigableSlice } from "./navigable";
import { selectable, type SelectableSlice } from "./selectable";
import type { CollectionBehaviorConfig } from "./collection-config";
import { collectionFromArray } from "../collection/collection";
import { createStore } from "../runtime/store";
import { announce, emitEvent } from "../runtime/effect";
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
/* NumberField = Focusable + NumericValue + Validatable                */
/* ------------------------------------------------------------------ */

const makeNumberField = (config: Record<string, unknown> = {}) => {
  const composed = composeMachine(
    "numberfield",
    [focusable, numericValue, validatable] as const,
    {
      min: 0,
      max: 100,
      step: 1,
      ...config,
    } as never,
  );
  const store = createStore(composed.machine);
  const press = (s: KeyStroke) => {
    const resolved = resolveBinding(composed.keymap(store.getState()), s);
    if (resolved) return store.dispatch(resolved.intent);
    return [];
  };
  const value = () => (store.getState().numeric as NumericValueSlice).value;
  return { composed, store, press, value };
};

describe("NumberField = Focusable + NumericValue + Validatable", () => {
  it("increments/decrements by step via ArrowUp/ArrowDown", () => {
    const { press, value, store } = makeNumberField();
    store.dispatch(numberIntents.set({ value: 5 }, "program"));
    press(stroke("ArrowUp"));
    expect(value()).toBe(6);
    press(stroke("ArrowDown"));
    press(stroke("ArrowDown"));
    expect(value()).toBe(4);
  });

  it("Shift+Arrow and PageUp/PageDown jump by bigStep (default 10×step)", () => {
    const { press, value, store } = makeNumberField();
    store.dispatch(numberIntents.set({ value: 50 }, "program"));
    press(stroke("ArrowUp", { shift: true }));
    expect(value()).toBe(60);
    press(stroke("PageDown"));
    expect(value()).toBe(50);
  });

  it("clamps to min/max on set and step", () => {
    const { press, value, store } = makeNumberField();
    store.dispatch(numberIntents.set({ value: 250 }, "program"));
    expect(value()).toBe(100);
    press(stroke("ArrowUp"));
    expect(value()).toBe(100); // saturated, no change
    store.dispatch(numberIntents.set({ value: -3 }, "program"));
    expect(value()).toBe(0);
  });

  it("stepping an empty field starts from min", () => {
    const { press, value } = makeNumberField();
    expect(value()).toBeNull();
    press(stroke("ArrowUp"));
    expect(value()).toBe(1);
  });

  it("is float-safe: 0.1 + 0.2 stays on the step grid", () => {
    const { press, value, store } = makeNumberField({ step: 0.1, min: 0, max: 1 });
    store.dispatch(numberIntents.set({ value: 0.2 }, "program"));
    press(stroke("ArrowUp"));
    expect(value()).toBe(0.3);
  });

  it("snap rounds onto the step grid from the min origin", () => {
    const { value, store } = makeNumberField({ min: 0, max: 100, step: 5 });
    store.dispatch(numberIntents.set({ value: 52.4, snap: true }, "program"));
    expect(value()).toBe(50);
  });

  it("does NOT bind Home/End in spinbutton mode (the caret needs them)", () => {
    const { composed, store } = makeNumberField();
    expect(resolveBinding(composed.keymap(store.getState()), stroke("Home"))).toBeNull();
    expect(resolveBinding(composed.keymap(store.getState()), stroke("End"))).toBeNull();
  });

  it("emits a change event only when the value actually changes", () => {
    const { store } = makeNumberField();
    const effects = store.dispatch(numberIntents.set({ value: 10 }, "program"));
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "change")).toBe(true);
    expect(store.dispatch(numberIntents.set({ value: 10 }, "program"))).toHaveLength(0);
  });

  it("disabled blocks every value mutation", () => {
    const { press, value, store } = makeNumberField({ disabled: true });
    store.dispatch(focusIntents.setDisabled({ disabled: true }, "program"));
    press(stroke("ArrowUp"));
    expect(value()).toBeNull();
    store.dispatch(numberIntents.set({ value: 42 }, "program"));
    expect(value()).toBeNull();
  });

  it("derives aria-valuemin/max/now and valuetext from state", () => {
    const { composed, store } = makeNumberField({
      getValueText: (v: number) => `${v} items`,
    });
    store.dispatch(numberIntents.set({ value: 42 }, "program"));
    const aria = composed.aria(store.getState());
    expect(aria["aria-valuemin"]).toBe(0);
    expect(aria["aria-valuemax"]).toBe(100);
    expect(aria["aria-valuenow"]).toBe(42);
    expect(aria["aria-valuetext"]).toBe("42 items");
  });
});

/* ------------------------------------------------------------------ */
/* Slider — same machine, slider keymap profile                        */
/* ------------------------------------------------------------------ */

describe("Slider = Focusable + NumericValue (keys: slider)", () => {
  const makeSlider = () => {
    const composed = composeMachine(
      "slider",
      [focusable, numericValue] as const,
      {
        min: 0,
        max: 100,
        step: 5,
        defaultValue: 50,
        keys: "slider",
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

  it("ArrowRight/ArrowLeft step like ArrowUp/ArrowDown", () => {
    const { press, value } = makeSlider();
    press(stroke("ArrowRight"));
    expect(value()).toBe(55);
    press(stroke("ArrowLeft"));
    press(stroke("ArrowLeft"));
    expect(value()).toBe(45);
  });

  it("Home/End jump to min/max in slider mode", () => {
    const { press, value } = makeSlider();
    press(stroke("Home"));
    expect(value()).toBe(0);
    press(stroke("End"));
    expect(value()).toBe(100);
  });

  it("pointer drag converges on the same intent: set with snap", () => {
    const { store, value } = makeSlider();
    // The adapter translates pointer geometry to a raw value; the core snaps.
    store.dispatch(numberIntents.set({ value: 63.2, snap: true }, "pointer"));
    expect(value()).toBe(65);
  });
});

/* ------------------------------------------------------------------ */
/* Validatable                                                         */
/* ------------------------------------------------------------------ */

describe("Validatable — dirty/touched/error lifecycle", () => {
  const makeField = (validate: (v: unknown) => string | null) => {
    let externalValue: unknown = "";
    const composed = composeMachine(
      "field",
      [focusable, validatable] as const,
      {
        validate,
        getFieldValue: () => externalValue,
      } as never,
    );
    const store = createStore(composed.machine);
    const slice = () => store.getState().validatable as ValidatableSlice;
    return { store, slice, setValue: (v: unknown) => (externalValue = v), composed };
  };

  const required = (v: unknown) => (v === "" || v === null ? "Ce champ est requis" : null);

  it("validate sets the error, announces it assertively and emits validityChange", () => {
    const { store, slice } = makeField(required);
    const effects = store.dispatch(validityIntents.validate(undefined, "program"));
    expect(slice().error).toBe("Ce champ est requis");
    expect(effects.some((e) => announce.match(e) && e.payload.politeness === "assertive")).toBe(
      true,
    );
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "validityChange")).toBe(
      true,
    );
  });

  it("re-validating the same error does not re-announce", () => {
    const { store } = makeField(required);
    store.dispatch(validityIntents.validate(undefined, "program"));
    const effects = store.dispatch(validityIntents.validate(undefined, "program"));
    expect(effects.some((e) => announce.match(e))).toBe(false);
  });

  it("clearing an error emits validityChange but stays quiet", () => {
    const { store, slice, setValue } = makeField(required);
    store.dispatch(validityIntents.validate(undefined, "program"));
    setValue("hello");
    const effects = store.dispatch(validityIntents.validate(undefined, "program"));
    expect(slice().error).toBeNull();
    expect(effects.some((e) => announce.match(e))).toBe(false);
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "validityChange")).toBe(
      true,
    );
  });

  it("touch marks touched and validates (blur semantics)", () => {
    const { store, slice } = makeField(required);
    store.dispatch(validityIntents.touch(undefined, "program"));
    expect(slice().touched).toBe(true);
    expect(slice().error).toBe("Ce champ est requis");
  });

  it("markDirty + reset round-trip back to pristine", () => {
    const { store, slice } = makeField(required);
    store.dispatch(validityIntents.markDirty(undefined, "program"));
    store.dispatch(validityIntents.touch(undefined, "program"));
    expect(slice()).toEqual({ dirty: true, touched: true, error: "Ce champ est requis" });
    store.dispatch(validityIntents.reset(undefined, "program"));
    expect(slice()).toEqual({ dirty: false, touched: false, error: null });
  });

  it("setError carries server-side errors and aria-invalid derives from state", () => {
    const { store, slice, composed } = makeField(required);
    store.dispatch(validityIntents.setError({ error: "Déjà pris" }, "program"));
    expect(slice().error).toBe("Déjà pris");
    expect(composed.aria(store.getState())["aria-invalid"]).toBe(true);
  });

  it("reads the value from a sibling slice during the same machine (NumberField)", () => {
    const composed = composeMachine(
      "numberfield",
      [focusable, numericValue, validatable] as const,
      {
        min: 0,
        max: 100,
        getFieldValue: (read: <T>(name: string) => T | undefined) =>
          read<NumericValueSlice>("numeric")?.value,
        validate: (v: unknown) => (v === null ? "Valeur requise" : null),
      } as never,
    );
    const store = createStore(composed.machine);
    store.dispatch(validityIntents.validate(undefined, "program"));
    expect((store.getState().validatable as ValidatableSlice).error).toBe("Valeur requise");
    store.dispatch(numberIntents.set({ value: 12 }, "program"));
    store.dispatch(validityIntents.validate(undefined, "program"));
    expect((store.getState().validatable as ValidatableSlice).error).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* RadioGroup = horizontal collection + selection-follows-focus        */
/* ------------------------------------------------------------------ */

describe("RadioGroup = Focusable + Navigable(horizontal) + Selectable(follow-focus)", () => {
  const makeRadioGroup = (orientation: "horizontal" | "both" = "horizontal") => {
    const collection = collectionFromArray(["S", "M", "L", "XL"], {
      getKey: (s) => s,
      getTextValue: (s) => s,
    });
    const config: CollectionBehaviorConfig = {
      getCollection: () => collection,
      selectionMode: "single",
      selectionFollowsFocus: true,
      orientation,
      wrap: true,
      defaultSelectedKeys: ["M"],
    };
    const composed = composeMachine(
      "radiogroup",
      [focusable, navigable, selectable] as const,
      config,
    );
    const store = createStore(composed.machine);
    const press = (s: KeyStroke) => {
      const resolved = resolveBinding(composed.keymap(store.getState()), s);
      if (resolved) store.dispatch(resolved.intent);
      return resolved;
    };
    const selected = () => [...(store.getState().selectable as SelectableSlice).selectedKeys];
    const focused = () => (store.getState().navigable as NavigableSlice).focusedKey;
    return { store, press, selected, focused };
  };

  it("starts on the default value (uncontrolled)", () => {
    const { selected } = makeRadioGroup();
    expect(selected()).toEqual(["M"]);
  });

  it("ArrowRight moves focus AND selection (selection follows focus)", () => {
    const { press, selected, focused } = makeRadioGroup();
    press(stroke("ArrowRight"));
    expect(focused()).toBe("S"); // first move lands on the first item
    press(stroke("ArrowRight"));
    expect(focused()).toBe("M");
    press(stroke("ArrowRight"));
    expect(focused()).toBe("L");
    expect(selected()).toEqual(["L"]);
  });

  it("does not bind ArrowDown in horizontal orientation", () => {
    const { press, focused } = makeRadioGroup();
    const resolved = press(stroke("ArrowDown"));
    expect(resolved).toBeNull();
    expect(focused()).toBeNull();
  });

  it("wraps around the ends", () => {
    const { press, selected } = makeRadioGroup();
    press(stroke("ArrowLeft")); // from nothing → wraps to last
    press(stroke("ArrowLeft"));
    expect(selected()).toEqual(["L"]);
  });

  it("orientation both binds all four arrows", () => {
    const { press, focused } = makeRadioGroup("both");
    press(stroke("ArrowDown"));
    expect(focused()).toBe("S");
    press(stroke("ArrowRight"));
    expect(focused()).toBe("M");
  });
});
