// @vitest-environment node
// PIN/OTP machine tested as a pure machine: intents in, state + effects out.
import { describe, expect, it } from "vitest";
import { createStore } from "../runtime/store";
import { emitEvent, focusElement, type Effect } from "../runtime/effect";
import { resolveBinding } from "../interaction/keymap";
import type { KeyStroke } from "../interaction/keys";
import { createPinMachine, pinIntents, pinKeymap, sanitizePinText, type PinState } from "./pin";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

const makePin = (config: Parameters<typeof createPinMachine>[0] = {}) => {
  const store = createStore(createPinMachine(config));
  const keymap = pinKeymap(config);
  const press = (s: KeyStroke): Effect[] => {
    const resolved = resolveBinding(keymap, s);
    return resolved ? [...store.dispatch(resolved.intent)] : [];
  };
  const state = () => store.getState() as PinState;
  return { store, press, state, keymap };
};

const focusTargets = (effects: readonly Effect[]) =>
  effects.filter(focusElement.match).map((e) => e.payload.target);
const eventNames = (effects: readonly Effect[]) =>
  effects.filter(emitEvent.match).map((e) => e.payload.name);

describe("PIN machine — typing", () => {
  it("typing fills the active segment and advances the cursor (with a focus effect)", () => {
    const { store, state } = makePin({ length: 4 });
    const effects = store.dispatch(pinIntents.input({ char: "1" }, "keyboard"));
    expect(state().values).toEqual(["1", "", "", ""]);
    expect(state().cursor).toBe(1);
    expect(focusTargets(effects)).toEqual(["1"]);
    expect(eventNames(effects)).toContain("change");
  });

  it("rejects characters outside the kind (numeric by default)", () => {
    const { store, state } = makePin({ length: 4 });
    expect(store.dispatch(pinIntents.input({ char: "a" }, "keyboard"))).toHaveLength(0);
    expect(state().values).toEqual(["", "", "", ""]);
  });

  it("alphanumeric kind accepts letters", () => {
    const { store, state } = makePin({ length: 4, kind: "alphanumeric" });
    store.dispatch(pinIntents.input({ char: "x" }, "keyboard"));
    expect(state().values[0]).toBe("x");
  });

  it("overwrites an already-filled segment", () => {
    const { store, state } = makePin({ length: 4 });
    store.dispatch(pinIntents.input({ char: "1" }, "keyboard"));
    store.dispatch(pinIntents.focusSegment({ index: 0 }, "pointer"));
    store.dispatch(pinIntents.input({ char: "9" }, "keyboard"));
    expect(state().values).toEqual(["9", "", "", ""]);
  });

  it("emits `complete` exactly once, when the last empty slot fills", () => {
    const { store } = makePin({ length: 3 });
    store.dispatch(pinIntents.input({ char: "1" }, "keyboard"));
    store.dispatch(pinIntents.input({ char: "2" }, "keyboard"));
    const last = store.dispatch(pinIntents.input({ char: "3" }, "keyboard"));
    expect(eventNames(last)).toEqual(["change", "complete"]);
    // Overwriting a full code emits change but not complete again.
    store.dispatch(pinIntents.focusSegment({ index: 0 }, "pointer"));
    const overwrite = store.dispatch(pinIntents.input({ char: "7" }, "keyboard"));
    expect(eventNames(overwrite)).toEqual(["change"]);
  });
});

describe("PIN machine — backspace & delete", () => {
  it("Backspace clears the active segment and stays when it was filled", () => {
    const { store, state } = makePin({ length: 4 });
    store.dispatch(pinIntents.input({ char: "1" }, "keyboard"));
    store.dispatch(pinIntents.input({ char: "2" }, "keyboard"));
    store.dispatch(pinIntents.focusSegment({ index: 1 }, "pointer"));
    store.dispatch(pinIntents.backspace(undefined, "keyboard"));
    expect(state().values).toEqual(["1", "", "", ""]);
    expect(state().cursor).toBe(1);
  });

  it("Backspace on an empty segment steps back and clears the previous one", () => {
    const { store, state } = makePin({ length: 4 });
    store.dispatch(pinIntents.input({ char: "1" }, "keyboard"));
    // cursor now on segment 1 (empty)
    const effects = store.dispatch(pinIntents.backspace(undefined, "keyboard"));
    expect(state().values).toEqual(["", "", "", ""]);
    expect(state().cursor).toBe(0);
    expect(focusTargets(effects)).toEqual(["0"]);
  });

  it("Backspace at the very start is a no-op", () => {
    const { store } = makePin({ length: 4 });
    expect(store.dispatch(pinIntents.backspace(undefined, "keyboard"))).toHaveLength(0);
  });

  it("Delete clears the active segment without moving", () => {
    const { store, state } = makePin({ length: 4 });
    store.dispatch(pinIntents.input({ char: "1" }, "keyboard"));
    store.dispatch(pinIntents.focusSegment({ index: 0 }, "pointer"));
    store.dispatch(pinIntents.deleteForward(undefined, "keyboard"));
    expect(state().values).toEqual(["", "", "", ""]);
    expect(state().cursor).toBe(0);
  });
});

describe("PIN machine — paste", () => {
  it("distributes sanitized text from the cursor (separators stripped)", () => {
    const { store, state } = makePin({ length: 6 });
    const effects = store.dispatch(pinIntents.paste({ text: "12-34 56" }, "program"));
    expect(state().values).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(eventNames(effects)).toEqual(["change", "complete"]);
  });

  it("handles TSV clipboard content", () => {
    const { store, state } = makePin({ length: 4 });
    store.dispatch(pinIntents.paste({ text: "9\t8\t7\t6" }, "program"));
    expect(state().values).toEqual(["9", "8", "7", "6"]);
  });

  it("pastes from the current segment and clips the overflow", () => {
    const { store, state } = makePin({ length: 4 });
    store.dispatch(pinIntents.focusSegment({ index: 2 }, "pointer"));
    store.dispatch(pinIntents.paste({ text: "12345" }, "program"));
    expect(state().values).toEqual(["", "", "1", "2"]);
    expect(state().cursor).toBe(3);
  });

  it("a clipboard with no accepted character is a no-op", () => {
    const { store } = makePin({ length: 4 });
    expect(store.dispatch(pinIntents.paste({ text: "abc!" }, "program"))).toHaveLength(0);
  });

  it("sanitizePinText keeps letters only in alphanumeric kind", () => {
    expect(sanitizePinText("a1-b2", "numeric")).toEqual(["1", "2"]);
    expect(sanitizePinText("a1-b2", "alphanumeric")).toEqual(["a", "1", "b", "2"]);
  });
});

describe("PIN machine — cursor & keymap", () => {
  it("arrows move the cursor with focus effects, clamped at the edges", () => {
    const { press, state } = makePin({ length: 3 });
    expect(press(stroke("ArrowLeft"))).toHaveLength(0); // already at 0
    const right = press(stroke("ArrowRight"));
    expect(state().cursor).toBe(1);
    expect(focusTargets(right)).toEqual(["1"]);
  });

  it("Home/End jump to the first/last segment with a focus effect", () => {
    const { press, state } = makePin({ length: 5 });
    const end = press(stroke("End"));
    expect(state().cursor).toBe(4);
    expect(focusTargets(end)).toEqual(["4"]);
    press(stroke("Home"));
    expect(state().cursor).toBe(0);
  });

  it("pointer focusSegment syncs the cursor without a focus effect (no loop)", () => {
    const { store, state } = makePin({ length: 4 });
    const effects = store.dispatch(pinIntents.focusSegment({ index: 2 }, "pointer"));
    expect(state().cursor).toBe(2);
    expect(focusTargets(effects)).toEqual([]);
  });

  it("the keymap lets non-accepted printables fall through (no preventDefault)", () => {
    const { keymap } = makePin({ length: 4 });
    expect(resolveBinding(keymap, stroke("a"))).toBeNull(); // numeric rejects letters
    expect(resolveBinding(keymap, stroke("5"))).not.toBeNull();
  });

  it("clear resets everything and focuses the first segment", () => {
    const { store, state } = makePin({ length: 3 });
    store.dispatch(pinIntents.paste({ text: "123" }, "program"));
    const effects = store.dispatch(pinIntents.clear(undefined, "pointer"));
    expect(state().values).toEqual(["", "", ""]);
    expect(state().cursor).toBe(0);
    expect(focusTargets(effects)).toEqual(["0"]);
    expect(eventNames(effects)).toEqual(["change"]);
  });

  it("program-sourced intents (controlled sync) never move DOM focus", () => {
    const { store } = makePin({ length: 4 });
    const paste = store.dispatch(pinIntents.paste({ text: "12" }, "program"));
    expect(focusTargets(paste)).toEqual([]);
    const clear = store.dispatch(pinIntents.clear(undefined, "program"));
    expect(focusTargets(clear)).toEqual([]);
  });
});
