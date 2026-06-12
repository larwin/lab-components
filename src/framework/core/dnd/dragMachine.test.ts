// @vitest-environment node
// Pure core: a complete Kanban drag — pointer and keyboard — without DOM.
import { describe, expect, it } from "vitest";
import { announce, emitEvent, type Effect } from "../runtime/effect";
import { createStore } from "../runtime/store";
import { createDragMachine, dragIntents, type DragMoveDetail } from "./dragMachine";

const ZONES: Record<string, string[]> = {
  todo: ["t1", "t2", "t3"],
  doing: ["d1"],
  done: [],
};

const make = () =>
  createStore(
    createDragMachine({
      getZones: () => Object.keys(ZONES),
      getZoneSize: (zone) => ZONES[zone].length,
      getItemLabel: (key) => `Task ${key}`,
      getZoneLabel: (zone) => zone.toUpperCase(),
    }),
  );

const moveDetail = (effects: readonly Effect[]): DragMoveDetail | undefined => {
  const e = effects.find((x) => emitEvent.match(x) && x.payload.name === "move");
  return e ? ((e.payload as { detail: DragMoveDetail }).detail as DragMoveDetail) : undefined;
};

describe("drag machine — pointer flow", () => {
  it("start → over → drop emits a move with from/to coordinates", () => {
    const store = make();
    store.dispatch(dragIntents.start({ zone: "todo", key: "t2", index: 1 }, "pointer"));
    expect(store.getState().active).toEqual({ zone: "todo", key: "t2", index: 1 });
    expect(store.getState().over).toBeNull(); // pointer drags target nothing yet
    store.dispatch(dragIntents.over({ zone: "doing", index: 1 }));
    const effects = store.dispatch(dragIntents.drop(undefined, "pointer"));
    expect(moveDetail(effects)).toEqual({
      key: "t2",
      fromZone: "todo",
      fromIndex: 1,
      toZone: "doing",
      toIndex: 1,
    });
    expect(store.getState().active).toBeNull();
  });

  it("dropping nowhere cancels", () => {
    const store = make();
    store.dispatch(dragIntents.start({ zone: "todo", key: "t1", index: 0 }, "pointer"));
    const effects = store.dispatch(dragIntents.drop(undefined, "pointer"));
    expect(moveDetail(effects)).toBeUndefined();
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "dragCancel")).toBe(true);
  });

  it("dropping on the original slot emits dragEnd but no move", () => {
    const store = make();
    store.dispatch(dragIntents.start({ zone: "todo", key: "t1", index: 0 }, "pointer"));
    store.dispatch(dragIntents.over({ zone: "todo", index: 0 }));
    const effects = store.dispatch(dragIntents.drop(undefined, "pointer"));
    expect(moveDetail(effects)).toBeUndefined();
    expect(effects.some((e) => emitEvent.match(e) && e.payload.name === "dragEnd")).toBe(true);
  });

  it("escape cancels and announces", () => {
    const store = make();
    store.dispatch(dragIntents.start({ zone: "todo", key: "t1", index: 0 }, "pointer"));
    const effects = store.dispatch(dragIntents.cancel(undefined, "keyboard"));
    expect(store.getState().active).toBeNull();
    expect(effects.some((e) => announce.match(e) && /cancelled/.test(e.payload.message))).toBe(
      true,
    );
  });
});

describe("drag machine — keyboard flow", () => {
  it("keyboard pickup targets its own slot and announces instructions", () => {
    const store = make();
    const effects = store.dispatch(
      dragIntents.start({ zone: "todo", key: "t2", index: 1 }, "keyboard"),
    );
    expect(store.getState().over).toEqual({ zone: "todo", index: 1 });
    const said = effects.find((e) => announce.match(e))!;
    expect((said.payload as { message: string }).message).toMatch(/picked up from TODO/);
  });

  it("arrows move the target across zones with clamped indices", () => {
    const store = make();
    store.dispatch(dragIntents.start({ zone: "todo", key: "t2", index: 1 }, "keyboard"));
    store.dispatch(dragIntents.moveTarget({ dZone: 1 }, "keyboard")); // → doing
    expect(store.getState().over).toEqual({ zone: "doing", index: 1 });
    store.dispatch(dragIntents.moveTarget({ dZone: 1 }, "keyboard")); // → done (empty)
    expect(store.getState().over).toEqual({ zone: "done", index: 0 });
    store.dispatch(dragIntents.moveTarget({ dZone: 1 }, "keyboard")); // clamped at last zone
    expect(store.getState().over?.zone).toBe("done");
    store.dispatch(dragIntents.moveTarget({ dIndex: 5 }, "keyboard")); // clamped in empty zone
    expect(store.getState().over).toEqual({ zone: "done", index: 0 });
  });

  it("within the source zone the max index accounts for the dragged item", () => {
    const store = make();
    store.dispatch(dragIntents.start({ zone: "todo", key: "t1", index: 0 }, "keyboard"));
    store.dispatch(dragIntents.moveTarget({ dIndex: 99 }, "keyboard"));
    expect(store.getState().over).toEqual({ zone: "todo", index: 2 }); // 3 items - itself
  });

  it("space drops at the keyboard target", () => {
    const store = make();
    store.dispatch(dragIntents.start({ zone: "todo", key: "t3", index: 2 }, "keyboard"));
    store.dispatch(dragIntents.moveTarget({ dZone: 1 }, "keyboard"));
    const effects = store.dispatch(dragIntents.drop(undefined, "keyboard"));
    expect(moveDetail(effects)).toMatchObject({ key: "t3", toZone: "doing" });
  });
});
