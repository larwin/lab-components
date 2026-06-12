// @vitest-environment node
// Pure core: data operations tested without DOM.
import { describe, expect, it } from "vitest";
import { filterRows, sortRows, toggleSort, type SortSpec } from "./query";

interface Row {
  name: string;
  dept: string;
  age: number;
}

const rows: Row[] = [
  { name: "Émile", dept: "B", age: 30 },
  { name: "alice", dept: "A", age: 25 },
  { name: "Bob", dept: "B", age: 25 },
  { name: "Eve", dept: "A", age: 30 },
];

describe("sortRows", () => {
  it("sorts culture-aware (é sorts with e, case-insensitive by locale rules)", () => {
    const sorted = sortRows(rows, [{ field: "name", direction: "asc" }]);
    expect(sorted.map((r) => r.name)).toEqual(["alice", "Bob", "Émile", "Eve"]);
  });

  it("multi-column sort with stability", () => {
    const specs: SortSpec[] = [
      { field: "dept", direction: "asc" },
      { field: "age", direction: "desc" },
    ];
    const sorted = sortRows(rows, specs);
    expect(sorted.map((r) => r.name)).toEqual(["Eve", "alice", "Émile", "Bob"]);
  });

  it("numbers sort numerically, not lexically", () => {
    const data = [{ v: 100 }, { v: 9 }, { v: 20 }];
    const sorted = sortRows(data, [{ field: "v", direction: "asc" }]);
    expect(sorted.map((r) => r.v)).toEqual([9, 20, 100]);
  });
});

describe("toggleSort", () => {
  it("cycles none → asc → desc → none", () => {
    let specs = toggleSort([], "name", false);
    expect(specs).toEqual([{ field: "name", direction: "asc" }]);
    specs = toggleSort(specs, "name", false);
    expect(specs).toEqual([{ field: "name", direction: "desc" }]);
    specs = toggleSort(specs, "name", false);
    expect(specs).toEqual([]);
  });

  it("additive mode appends; non-additive replaces", () => {
    let specs = toggleSort([], "dept", false);
    specs = toggleSort(specs, "age", true);
    expect(specs.map((s) => s.field)).toEqual(["dept", "age"]);
    specs = toggleSort(specs, "name", false);
    expect(specs.map((s) => s.field)).toEqual(["name"]);
  });
});

describe("filterRows", () => {
  it("matches across fields, ignoring case and diacritics", () => {
    expect(filterRows(rows, "émile", ["name"]).map((r) => r.name)).toEqual(["Émile"]);
    expect(filterRows(rows, "EMILE", ["name"]).map((r) => r.name)).toEqual(["Émile"]);
    expect(filterRows(rows, "b", ["name", "dept"])).toHaveLength(2); // Bob + Émile (dept B)
  });

  it("returns the original array reference for an empty query", () => {
    expect(filterRows(rows, "  ", ["name"])).toBe(rows);
  });
});
