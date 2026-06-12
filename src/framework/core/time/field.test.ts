// @vitest-environment node
// Time field — the time configuration of the generic segment-field machine.
import { describe, expect, it } from "vitest";
import { createStore } from "../runtime/store";
import { emitEvent, type Effect } from "../runtime/effect";
import { resolveBinding } from "../interaction/keymap";
import type { KeyStroke } from "../interaction/keys";
import { segmentFieldIntents, type SegmentFieldState } from "../field/segments";
import {
  createTimeFieldMachine,
  dayPeriodParser,
  timeFieldKeymap,
  timeFieldValue,
  timeSegmentAria,
  timeSegmentValues,
  type TimeFieldConfig,
} from "./field";
import { timeValue, type TimeValue } from "./value";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

const US: TimeFieldConfig = {
  segments: ["hour", "minute", "dayPeriod"], // en-US order
  hourCycle: "h12",
  dayPeriodLabels: ["AM", "PM"],
  getPlaceholderTime: () => timeValue(14, 30),
};

const FR: TimeFieldConfig = {
  segments: ["hour", "minute"],
  hourCycle: "h23",
  getPlaceholderTime: () => timeValue(14, 30),
};

const makeField = (config: TimeFieldConfig) => {
  const store = createStore(createTimeFieldMachine(config));
  const keymap = timeFieldKeymap(config);
  const press = (s: KeyStroke): Effect[] => {
    const resolved = resolveBinding(keymap, s);
    return resolved ? [...store.dispatch(resolved.intent)] : [];
  };
  const type = (text: string): Effect[] => [...text].flatMap((char) => press(stroke(char)));
  const state = () => store.getState() as SegmentFieldState;
  const value = () => timeFieldValue(state().values, config);
  return { store, press, type, state, value };
};

const changes = (effects: readonly Effect[]) =>
  effects
    .filter(emitEvent.match)
    .filter((e) => e.payload.name === "change")
    .map((e) => (e.payload.detail as { value: TimeValue | null }).value);

describe("time field — h12 typing with AM/PM", () => {
  it("types 2:30 PM and composes hour 14 (display 2 + PM → storage 14)", () => {
    const { type, state, value } = makeField(US);
    const fx1 = type("2"); // 2*10 > 12 → auto-advance
    expect(state().values.hour).toBe(2);
    expect(state().cursor).toBe(1);
    expect(changes(fx1)).toEqual([]);
    type("30");
    expect(state().cursor).toBe(2); // onto dayPeriod
    const effects = type("p"); // localized PM initial
    expect(state().values.dayPeriod).toBe(1);
    expect(value()).toEqual(timeValue(14, 30));
    expect(changes(effects)).toEqual([timeValue(14, 30)]);
  });

  it("the dayPeriod segment is textual: arrows toggle, 'a'/'p' set outright", () => {
    const { store, press, state } = makeField(US);
    store.dispatch(segmentFieldIntents.focusSegment({ index: 2 }, "program"));
    press(stroke("ArrowUp")); // empty → placeholder 14:30 → PM
    expect(state().values.dayPeriod).toBe(1);
    press(stroke("ArrowUp")); // wraps 1 → 0
    expect(state().values.dayPeriod).toBe(0);
    store.dispatch(segmentFieldIntents.input({ char: "p" }, "keyboard"));
    expect(state().values.dayPeriod).toBe(1);
    store.dispatch(segmentFieldIntents.input({ char: "x" }, "keyboard"));
    expect(state().values.dayPeriod).toBe(1); // unmatched chars are inert
  });

  it("matches localized day-period initials, with latin a/p fallback", () => {
    const greek = dayPeriodParser(["π.μ.", "μ.μ."]);
    expect(greek("π")).toBe(0);
    expect(greek("μ")).toBe(1);
    expect(greek("a")).toBe(0); // latin fallback always works
    expect(greek("p")).toBe(1);
    expect(greek("z")).toBeNull();
  });

  it("midnight round-trips: 12 AM ↔ hour 0", () => {
    const { type, value } = makeField(US);
    type("12"); // display 12
    type("00");
    type("a");
    expect(value()).toEqual(timeValue(0, 0));
    expect(timeSegmentValues(timeValue(0, 0), US)).toMatchObject({
      hour: 12,
      minute: 0,
      dayPeriod: 0,
    });
  });

  it("a complete value needs the dayPeriod — 2:30 without AM/PM stays null", () => {
    const { type, value } = makeField(US);
    type("230");
    expect(value()).toBeNull();
  });
});

describe("time field — h23 (fr)", () => {
  it("types 14:05 digit by digit and emits once", () => {
    const { type, state, value } = makeField(FR);
    type("14"); // "1" waits (could be 1x ≤ 23), "4" fills
    expect(state().values.hour).toBe(14);
    expect(state().cursor).toBe(1);
    const effects = type("05");
    expect(value()).toEqual(timeValue(14, 5));
    expect(changes(effects)).toEqual([timeValue(14, 5)]);
  });

  it("hour 3 auto-advances (3x > 23); arrows wrap 23 → 0", () => {
    const { type, press, state } = makeField(FR);
    type("3");
    expect(state().values.hour).toBe(3);
    expect(state().cursor).toBe(1);
    press(stroke("Home"));
    type("23");
    press(stroke("Home"));
    press(stroke("ArrowUp"));
    expect(state().values.hour).toBe(0);
    press(stroke("ArrowDown"));
    expect(state().values.hour).toBe(23);
  });

  it("minutes wrap 59 → 0", () => {
    const { store, press, state } = makeField(FR);
    store.dispatch(
      segmentFieldIntents.setValues(
        { values: timeSegmentValues(timeValue(10, 59), FR) },
        "program",
      ),
    );
    store.dispatch(segmentFieldIntents.focusSegment({ index: 1 }, "program"));
    press(stroke("ArrowUp"));
    expect(state().values.minute).toBe(0);
  });

  it("no dayPeriod segment: letters fall through the keymap (no binding match)", () => {
    const config = FR;
    const keymap = timeFieldKeymap(config);
    expect(resolveBinding(keymap, stroke("a"))).toBeNull();
    expect(resolveBinding(keymap, stroke("5"))).not.toBeNull();
  });
});

describe("time field — seconds, sync & ARIA", () => {
  it("seconds are opt-in: composed value carries them only when configured", () => {
    const withSeconds: TimeFieldConfig = { ...FR, segments: ["hour", "minute", "second"] };
    const { type, value } = makeField(withSeconds);
    type("140509");
    expect(value()).toEqual(timeValue(14, 5, 9));
    const { value: noSeconds, type: type2 } = makeField(FR);
    type2("1405");
    expect(noSeconds()).not.toHaveProperty("second");
  });

  it("setValues (program) fills segments silently in display units", () => {
    const { store, state, value } = makeField(US);
    const effects = store.dispatch(
      segmentFieldIntents.setValues(
        { values: timeSegmentValues(timeValue(14, 30), US) },
        "program",
      ),
    );
    expect(state().values.hour).toBe(2); // display hour, not storage
    expect(value()).toEqual(timeValue(14, 30));
    expect(effects).toHaveLength(0);
  });

  it("segment ARIA derives bounds from the cycle; dayPeriod announces its label", () => {
    expect(timeSegmentAria("hour", 2, US)).toMatchObject({
      role: "spinbutton",
      "aria-valuemin": 1,
      "aria-valuemax": 12,
      "aria-valuenow": 2,
    });
    expect(timeSegmentAria("hour", 0, FR)).toMatchObject({
      "aria-valuemin": 0,
      "aria-valuemax": 23,
    });
    expect(timeSegmentAria("dayPeriod", 1, US)["aria-valuetext"]).toBe("PM");
  });
});
