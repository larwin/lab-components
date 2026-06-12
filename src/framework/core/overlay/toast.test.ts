// @vitest-environment node
// The toast queue is a pure machine: timers and announcements are effects,
// so the entire lifecycle is assertable without a DOM or a real clock.
import { describe, expect, it } from "vitest";
import { createStore } from "../runtime/store";
import { announce, emitEvent } from "../runtime/effect";
import { cancelDismiss, createToastMachine, scheduleDismiss, toastIntents } from "./toast";

const make = (config?: Parameters<typeof createToastMachine>[0]) =>
  createStore(createToastMachine(config));

const enqueue = (
  store: ReturnType<typeof make>,
  id: string,
  extra: Partial<Parameters<typeof toastIntents.enqueue>[0]> = {},
) =>
  store.dispatch(
    toastIntents.enqueue({ id, title: `Toast ${id}`, now: 1000, ...extra }, "program"),
  );

describe("Toast machine — queue with injected time", () => {
  it("enqueue adds the toast, announces it and schedules its dismissal", () => {
    const store = make({ defaultDuration: 3000 });
    const effects = enqueue(store, "a");
    expect(store.getState().toasts.map((t) => t.id)).toEqual(["a"]);
    expect(effects.some((e) => announce.match(e) && e.payload.politeness === "polite")).toBe(true);
    const timer = effects.find((e) => scheduleDismiss.match(e));
    expect(timer?.payload).toEqual({ id: "a", delay: 3000 });
  });

  it("errors and warnings are announced assertively", () => {
    const store = make();
    const effects = enqueue(store, "err", { kind: "error", description: "Disque plein" });
    const cry = effects.find((e) => announce.match(e));
    expect(cry?.payload).toMatchObject({
      politeness: "assertive",
      message: "Toast err. Disque plein",
    });
  });

  it("duration null = sticky: no timer scheduled", () => {
    const store = make();
    const effects = enqueue(store, "sticky", { duration: null });
    expect(effects.some((e) => scheduleDismiss.match(e))).toBe(false);
  });

  it("dismiss removes the toast, cancels its timer and emits toastDismissed", () => {
    const store = make();
    enqueue(store, "a");
    const effects = store.dispatch(toastIntents.dismiss({ id: "a" }, "pointer"));
    expect(store.getState().toasts).toHaveLength(0);
    expect(effects.some((e) => cancelDismiss.match(e) && e.payload.id === "a")).toBe(true);
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "toastDismissed")).toBe(
      true,
    );
    // dismissing twice is a no-op
    expect(store.dispatch(toastIntents.dismiss({ id: "a" }, "pointer"))).toHaveLength(0);
  });

  it("evicts the oldest toast beyond maxToasts and cancels its timer", () => {
    const store = make({ maxToasts: 2 });
    enqueue(store, "a");
    enqueue(store, "b");
    const effects = enqueue(store, "c");
    expect(store.getState().toasts.map((t) => t.id)).toEqual(["b", "c"]);
    expect(effects.some((e) => cancelDismiss.match(e) && e.payload.id === "a")).toBe(true);
  });

  it("clear empties the queue and cancels every pending timer", () => {
    const store = make();
    enqueue(store, "a");
    enqueue(store, "b", { duration: null });
    const effects = store.dispatch(toastIntents.clear(undefined, "program"));
    expect(store.getState().toasts).toHaveLength(0);
    // only "a" had a timer
    expect(effects.filter((e) => cancelDismiss.match(e))).toHaveLength(1);
  });
});
