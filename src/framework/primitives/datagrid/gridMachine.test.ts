// @vitest-environment node
// Pure: the full spreadsheet machine — cursor, selection, sort, inline
// editing and clipboard — tested without DOM or React.
import { describe, expect, it } from "vitest";
import { createStore, emitEvent, resolveBinding, type KeyStroke } from "@/framework/core";
import {
  GRID_KEYMAP,
  MIN_COLUMN_WIDTH,
  clipboardCopy,
  createGridMachine,
  effectiveColumnOrder,
  gridIntents,
} from "./gridMachine";

const DATA = [
  ["a1", "b1", "c1"],
  ["a2", "b2", "c2"],
  ["a3", "b3", "c3"],
];

const COLUMN_IDS = ["a", "b", "c"];

const make = (editable = true) =>
  createStore(
    createGridMachine({
      rowCount: () => DATA.length,
      colCount: () => 3,
      getRowKey: (i) => `row-${i}`,
      getColumnIds: () => COLUMN_IDS,
      getSortField: () => null,
      selectionMode: "multiple",
      isCellEditable: editable ? (_r, c) => c !== 0 : undefined,
      getCellText: (r, c) => DATA[r][c],
    }),
  );

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

describe("grid machine — cursor & selection", () => {
  it("moves and clamps the 2D cursor", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 0, col: 0 }));
    store.dispatch(gridIntents.move({ dRow: 10, dCol: 10 }));
    expect(store.getState().cursor).toEqual({ row: 2, col: 2 });
  });

  it("extends row selection from the anchor with Shift", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 0, col: 0 }));
    store.dispatch(gridIntents.selectRow({}));
    store.dispatch(gridIntents.move({ dRow: 2, dCol: 0, extend: true }));
    expect([...store.getState().selectedRows]).toEqual(["row-0", "row-1", "row-2"]);
  });
});

describe("grid machine — inline editing", () => {
  it("starts editing the cursor cell, seeded with the cell text", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 1, col: 1 }));
    store.dispatch(gridIntents.editStart({}));
    expect(store.getState().editing).toEqual({ row: 1, col: 1, draft: "b2" });
  });

  it("type-to-edit seeds the draft with the typed character", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 0, col: 2 }));
    const resolved = resolveBinding(GRID_KEYMAP, stroke("x"));
    store.dispatch(resolved!.intent);
    expect(store.getState().editing).toEqual({ row: 0, col: 2, draft: "x" });
  });

  it("refuses to edit non-editable cells", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 0, col: 0 })); // col 0 read-only
    store.dispatch(gridIntents.editStart({}));
    expect(store.getState().editing).toBeNull();
  });

  it("navigation is modal while editing", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 1, col: 1 }));
    store.dispatch(gridIntents.editStart({}));
    store.dispatch(gridIntents.move({ dRow: 1, dCol: 0 }));
    expect(store.getState().cursor).toEqual({ row: 1, col: 1 });
    expect(store.getState().editing).not.toBeNull();
  });

  it("commit emits cellCommit with the draft and moves like a spreadsheet", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 1, col: 1 }));
    store.dispatch(gridIntents.editStart({}));
    store.dispatch(gridIntents.editChange({ value: "hello" }));
    const effects = store.dispatch(gridIntents.editCommit({ direction: "down" }));
    const commit = effects.find((e) => emitEvent.match(e) && e.payload.name === "cellCommit")!;
    expect((commit.payload as { detail: unknown }).detail).toEqual({
      row: 1,
      col: 1,
      rowKey: "row-1",
      value: "hello",
    });
    expect(store.getState().editing).toBeNull();
    expect(store.getState().cursor).toEqual({ row: 2, col: 1 }); // Enter ↓
  });

  it("cancel drops the draft without emitting", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 1, col: 1 }));
    store.dispatch(gridIntents.editStart({}));
    store.dispatch(gridIntents.editChange({ value: "junk" }));
    const effects = store.dispatch(gridIntents.editCancel(undefined));
    expect(effects).toHaveLength(0);
    expect(store.getState().editing).toBeNull();
  });
});

describe("grid machine — clipboard", () => {
  it("copies the cursor cell when nothing is selected", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 1, col: 2 }));
    const effects = store.dispatch(gridIntents.copy(undefined));
    const copy = effects.find((e) => clipboardCopy.match(e))!;
    expect(copy.payload).toEqual({ text: "c2", rows: 1 });
  });

  it("copies selected rows as TSV in row order", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 2, col: 0 }));
    store.dispatch(gridIntents.selectRow({}));
    store.dispatch(gridIntents.selectRow({ row: 0, toggle: true }));
    const effects = store.dispatch(gridIntents.copy(undefined));
    const copy = effects.find((e) => clipboardCopy.match(e))!;
    expect(copy.payload).toEqual({ text: "a1\tb1\tc1\na3\tb3\tc3", rows: 2 });
  });

  it("paste emits the parsed block anchored at the cursor", () => {
    const store = make();
    store.dispatch(gridIntents.moveTo({ row: 1, col: 1 }));
    const effects = store.dispatch(gridIntents.paste({ values: [["x", "y"], ["z"]] }));
    const paste = effects.find((e) => emitEvent.match(e) && e.payload.name === "cellsPaste")!;
    expect((paste.payload as { detail: unknown }).detail).toEqual({
      row: 1,
      col: 1,
      values: [["x", "y"], ["z"]],
    });
  });
});

describe("grid machine — columns", () => {
  it("resizes with a minimum width clamp", () => {
    const store = make();
    store.dispatch(gridIntents.resizeColumn({ columnId: "b", width: 240 }));
    expect(store.getState().columns.widths.b).toBe(240);
    store.dispatch(gridIntents.resizeColumn({ columnId: "b", width: 5 }));
    expect(store.getState().columns.widths.b).toBe(MIN_COLUMN_WIDTH);
  });

  it("reorders within the unpinned region", () => {
    const store = make();
    store.dispatch(gridIntents.moveColumn({ columnId: "c", toIndex: 0 }));
    expect(effectiveColumnOrder(store.getState().columns, COLUMN_IDS)).toEqual(["c", "a", "b"]);
  });

  it("pins to the start and unpins back into the order", () => {
    const store = make();
    store.dispatch(gridIntents.pinColumn({ columnId: "b", pinned: true }));
    expect(effectiveColumnOrder(store.getState().columns, COLUMN_IDS)).toEqual(["b", "a", "c"]);
    // pinned columns refuse reordering
    store.dispatch(gridIntents.moveColumn({ columnId: "b", toIndex: 2 }));
    expect(effectiveColumnOrder(store.getState().columns, COLUMN_IDS)).toEqual(["b", "a", "c"]);
    store.dispatch(gridIntents.pinColumn({ columnId: "b", pinned: false }));
    expect(effectiveColumnOrder(store.getState().columns, COLUMN_IDS)).toEqual(["a", "b", "c"]);
  });

  it("effectiveColumnOrder tolerates ids added after a reorder", () => {
    const columns = { order: ["c", "a"], widths: {}, pinnedLeft: [] };
    expect(effectiveColumnOrder(columns, ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("paste is ignored on read-only grids", () => {
    const store = make(false);
    store.dispatch(gridIntents.moveTo({ row: 1, col: 1 }));
    expect(store.dispatch(gridIntents.paste({ values: [["x"]] }))).toHaveLength(0);
  });
});
