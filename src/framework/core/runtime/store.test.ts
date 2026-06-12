// @vitest-environment node
// Pure core: these tests run without DOM, browser or React.
import { describe, expect, it, vi } from "vitest";
import { defineIntent } from "./intent";
import { defineEffect } from "./effect";
import { createMachine, withEffects } from "./machine";
import { createStore, inspect } from "./store";

const increment = defineIntent<{ by: number }>("counter/increment");
const reset = defineIntent<void>("counter/reset");
const ding = defineEffect<{ value: number }>("test/ding");

const counterMachine = () =>
  createMachine<{ count: number }>({
    id: "counter",
    initialState: { count: 0 },
    handlers: {
      [increment.type]: (state, intent) => {
        const next = { count: state.count + (intent.payload as { by: number }).by };
        return next.count >= 3 ? withEffects(next, ding({ value: next.count })) : next;
      },
      [reset.type]: (state) => (state.count === 0 ? state : { count: 0 }),
    },
  });

describe("store (Intent → Reducer → State → Effects)", () => {
  it("dispatches intents through the pure reducer", () => {
    const store = createStore(counterMachine());
    store.dispatch(increment({ by: 2 }));
    expect(store.getState()).toEqual({ count: 2 });
  });

  it("ignores unknown intents by design", () => {
    const store = createStore(counterMachine());
    const before = store.getState();
    store.dispatch({ type: "nope", payload: undefined, source: "program" });
    expect(store.getState()).toBe(before);
  });

  it("returns effects from dispatch and forwards them to handlers", () => {
    const store = createStore(counterMachine());
    const seen: unknown[] = [];
    store.onEffect((effect) => seen.push(effect));
    const effects = store.dispatch(increment({ by: 5 }));
    expect(effects).toHaveLength(1);
    expect(ding.match(effects[0])).toBe(true);
    expect(seen).toHaveLength(1);
  });

  it("only notifies subscribers when state actually changes", () => {
    const store = createStore(counterMachine());
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch(reset(undefined)); // count already 0 → same reference
    expect(listener).not.toHaveBeenCalled();
    store.dispatch(increment({ by: 1 }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("records a journal usable for time travel", () => {
    const store = createStore(counterMachine(), { now: () => 42 });
    store.dispatch(increment({ by: 1 }));
    store.dispatch(increment({ by: 1 }));
    const journal = store.getJournal();
    expect(journal).toHaveLength(2);
    expect(journal[0].prevState).toEqual({ count: 0 });
    expect(journal[1].nextState).toEqual({ count: 2 });
    expect(journal[0].at).toBe(42);
    // time travel
    store.replaceState(journal[0].nextState);
    expect(store.getState()).toEqual({ count: 1 });
  });

  it("broadcasts every transition to the global inspector", () => {
    const records: unknown[] = [];
    const stop = inspect((r) => records.push(r));
    const store = createStore(counterMachine());
    store.dispatch(increment({ by: 1 }));
    stop();
    store.dispatch(increment({ by: 1 }));
    expect(records).toHaveLength(1);
  });
});
