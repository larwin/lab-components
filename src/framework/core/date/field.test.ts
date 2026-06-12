// @vitest-environment node
// Date field machine — segmented spinbuttons tested as a pure machine.
import { describe, expect, it } from "vitest";
import { createStore } from "../runtime/store";
import { emitEvent, focusElement, type Effect } from "../runtime/effect";
import { resolveBinding } from "../interaction/keymap";
import type { KeyStroke } from "../interaction/keys";
import {
  createDateFieldMachine,
  dateFieldIntents,
  dateFieldKeymap,
  dateFieldValue,
  dateSegmentAria,
  normalizeDigit,
  type DateFieldConfig,
  type DateFieldState,
} from "./field";
import { dateValue, type DateValue } from "./value";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

const makeField = (config: Partial<DateFieldConfig> = {}) => {
  const full: DateFieldConfig = {
    segments: ["day", "month", "year"], // fr order
    getPlaceholderDate: () => dateValue(2026, 6, 12),
    ...config,
  };
  const store = createStore(createDateFieldMachine(full));
  const keymap = dateFieldKeymap(full);
  const press = (s: KeyStroke): Effect[] => {
    const resolved = resolveBinding(keymap, s);
    return resolved ? [...store.dispatch(resolved.intent)] : [];
  };
  const type = (text: string): Effect[] => [...text].flatMap((char) => press(stroke(char)));
  const state = () => store.getState() as DateFieldState;
  return { store, press, type, state };
};

const focusTargets = (effects: readonly Effect[]) =>
  effects.filter(focusElement.match).map((e) => e.payload.target);
const changes = (effects: readonly Effect[]) =>
  effects
    .filter(emitEvent.match)
    .filter((e) => e.payload.name === "change")
    .map((e) => (e.payload.detail as { date: DateValue | null }).date);

describe("date field — typing with auto-advance", () => {
  it("types a full fr date digit by digit (dd/mm/yyyy) and emits one change", () => {
    const { type, state } = makeField();
    type("12");
    expect(state().day).toBe(12);
    expect(state().cursor).toBe(1); // two digits fill the day
    type("06");
    expect(state().month).toBe(6);
    expect(state().cursor).toBe(2);
    const effects = type("2026");
    expect(state().year).toBe(2026);
    expect(changes(effects)).toEqual([dateValue(2026, 6, 12)]);
  });

  it("a digit that can only complete the segment advances immediately (day 4 → 04)", () => {
    const { type, state } = makeField();
    const effects = type("4");
    expect(state().day).toBe(4);
    expect(state().cursor).toBe(1);
    expect(focusTargets(effects)).toEqual(["1"]);
  });

  it("month: 1 waits (could be 10-12), 2 advances; overflow restarts the segment", () => {
    const { type, state } = makeField();
    type("12"); // day done
    type("1");
    expect(state().cursor).toBe(1); // "1" might become 10-12
    type("3"); // 13 > 12 → restart with 3, which advances (3*10 > 12)
    expect(state().month).toBe(3);
    expect(state().cursor).toBe(2);
  });

  it("normalizes Arabic-Indic digits (٣ → 3)", () => {
    expect(normalizeDigit("٣")).toBe("3");
    expect(normalizeDigit("۷")).toBe("7");
    const { type, state } = makeField();
    type("٣"); // day 3 — waits (could be 30/31)
    expect(state().day).toBe(3);
  });

  it("a complete date with an impossible day clamps to the month length", () => {
    const { type, state } = makeField();
    type("31"); // day
    type("02"); // February
    const effects = type("2026");
    expect(dateFieldValue(state())).toEqual(dateValue(2026, 2, 28));
    expect(changes(effects)).toEqual([dateValue(2026, 2, 28)]);
  });
});

describe("date field — spinbutton arrows", () => {
  it("ArrowUp on an empty segment seeds from the injected placeholder date", () => {
    const { press, state } = makeField();
    press(stroke("ArrowUp"));
    expect(state().day).toBe(12); // placeholder day
  });

  it("day wraps on the real month length when month/year are known", () => {
    const { store, press, state } = makeField();
    store.dispatch(dateFieldIntents.setValue({ date: dateValue(2026, 2, 28) }, "program"));
    press(stroke("ArrowUp")); // Feb 2026 has 28 days → wrap to 1
    expect(state().day).toBe(1);
    press(stroke("ArrowDown"));
    expect(state().day).toBe(28);
  });

  it("month wraps 12 → 1; year clamps without wrapping", () => {
    const { store, press, state } = makeField();
    store.dispatch(dateFieldIntents.setValue({ date: dateValue(9999, 12, 1) }, "program"));
    store.dispatch(dateFieldIntents.focusSegment({ index: 1 }, "program"));
    press(stroke("ArrowUp"));
    expect(state().month).toBe(1);
    store.dispatch(dateFieldIntents.focusSegment({ index: 2 }, "program"));
    press(stroke("ArrowUp"));
    expect(state().year).toBe(9999);
  });

  it("an incomplete field emits no change while stepping", () => {
    const { press } = makeField();
    const effects = press(stroke("ArrowUp"));
    expect(changes(effects)).toEqual([]);
  });
});

describe("date field — cursor & clearing", () => {
  it("arrows move between segments with focus effects; RTL flips them", () => {
    const ltr = makeField();
    ltr.press(stroke("ArrowRight"));
    expect(ltr.state().cursor).toBe(1);
    const rtl = makeField({ direction: () => "rtl" });
    rtl.press(stroke("ArrowLeft"));
    expect(rtl.state().cursor).toBe(1);
  });

  it("Home/End jump to the first/last segment", () => {
    const { press, state } = makeField();
    press(stroke("End"));
    expect(state().cursor).toBe(2);
    press(stroke("Home"));
    expect(state().cursor).toBe(0);
  });

  it("Backspace clears the segment, then steps back and clears (PIN pattern)", () => {
    const { type, press, state } = makeField();
    type("1206"); // day 12, month 6, cursor on year
    press(stroke("Backspace")); // year empty → step back, clear month
    expect(state().cursor).toBe(1);
    expect(state().month).toBeNull();
    press(stroke("Backspace")); // month already cleared → step back, clear day
    expect(state().cursor).toBe(0);
    expect(state().day).toBeNull();
  });

  it("emptying a complete date emits change(null) exactly once", () => {
    const { type, press } = makeField();
    type("12062026");
    const effects = press(stroke("Backspace")); // clears year → value null
    expect(changes(effects)).toEqual([null]);
    expect(changes(press(stroke("Backspace")))).toEqual([]); // already null
  });
});

describe("date field — drafts commit, never drip", () => {
  it("typing a year emits once at the 4th digit, not 2 → 20 → 202", () => {
    const { type } = makeField();
    type("1206");
    expect(changes(type("202"))).toEqual([]); // draft — no drip
    expect(changes(type("6"))).toEqual([dateValue(2026, 6, 12)]);
  });

  it("leaving a partial segment commits it (ArrowLeft, or blur via commit intent)", () => {
    const { store, type, press, state } = makeField();
    type("1206");
    type("85"); // year draft "85"
    const effects = press(stroke("ArrowLeft")); // moving away commits year 85
    expect(changes(effects)).toEqual([dateValue(85, 6, 12)]);
    type("9"); // month 9 — auto-advances back onto the year segment
    expect(state().cursor).toBe(2);
    press(stroke("Backspace")); // clear year
    type("31"); // year draft "31"
    const committed = store.dispatch(dateFieldIntents.commit(undefined, "pointer"));
    expect(changes([...committed])).toEqual([dateValue(31, 9, 12)]);
  });
});

describe("date field — controlled sync & ARIA", () => {
  it("setValue (program) fills segments silently", () => {
    const { store, state } = makeField();
    const effects = store.dispatch(
      dateFieldIntents.setValue({ date: dateValue(2026, 6, 12) }, "program"),
    );
    expect(state().day).toBe(12);
    expect(dateFieldValue(state())).toEqual(dateValue(2026, 6, 12));
    expect(effects).toHaveLength(0);
  });

  it("segment ARIA derives spinbutton semantics from the type", () => {
    expect(dateSegmentAria("month", 6)).toMatchObject({
      role: "spinbutton",
      "aria-valuemin": 1,
      "aria-valuemax": 12,
      "aria-valuenow": 6,
    });
    expect(dateSegmentAria("year", null)["aria-valuenow"]).toBeUndefined();
  });

  it("segment order is pure config — en-US (mdy) writes the month first", () => {
    const { type, state } = makeField({ segments: ["month", "day", "year"] });
    type("06");
    expect(state().month).toBe(6);
    expect(state().day).toBeNull();
  });
});
