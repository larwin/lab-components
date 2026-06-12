// @vitest-environment node
// Pure core: row grouping and aggregations tested without DOM.
import { describe, expect, it } from "vitest";
import { buildGroups, flattenGroups } from "./grouping";

interface Row {
  cat: string;
  status: string;
  price: number;
}

const rows: Row[] = [
  { cat: "B", status: "on", price: 10 },
  { cat: "A", status: "off", price: 30 },
  { cat: "A", status: "on", price: 20 },
  { cat: "B", status: "on", price: 40 },
  { cat: "A", status: "on", price: 50 },
];

describe("buildGroups", () => {
  it("groups by one field, ordered by value", () => {
    const groups = buildGroups(rows, ["cat"]);
    expect(groups.map((g) => [g.value, g.count])).toEqual([
      ["A", 3],
      ["B", 2],
    ]);
    expect(groups[0].key).toBe("cat:A");
  });

  it("nests multi-level groups with path keys", () => {
    const groups = buildGroups(rows, ["cat", "status"]);
    const a = groups[0];
    expect(a.children.map((c) => [c.key, c.count])).toEqual([
      ["cat:A/status:off", 1],
      ["cat:A/status:on", 2],
    ]);
    expect(a.children[0].depth).toBe(1);
  });

  it("computes aggregates per group", () => {
    const groups = buildGroups(rows, ["cat"], {
      aggregates: [
        { field: "price", fn: "sum" },
        { field: "status", fn: "count" },
      ],
    });
    expect(groups[0].aggregates.price).toBe(100); // A: 30+20+50
    expect(groups[1].aggregates.price).toBe(50); // B: 10+40
    expect(groups[0].aggregates.status).toBe(3);
  });

  it("supports avg/min/max and skips non-numeric values", () => {
    const groups = buildGroups(rows, ["cat"], {
      aggregates: [{ field: "price", fn: "avg" }],
    });
    expect(groups[0].aggregates.price).toBeCloseTo(100 / 3);
    const minMax = buildGroups(rows, ["cat"], {
      aggregates: [{ field: "price", fn: "max" }],
    });
    expect(minMax[1].aggregates.price).toBe(40);
  });

  it("returns no groups for an empty groupBy", () => {
    expect(buildGroups(rows, [])).toEqual([]);
  });
});

describe("flattenGroups", () => {
  it("interleaves group headers and leaf rows with depth", () => {
    const flat = flattenGroups(buildGroups(rows, ["cat"]), new Set());
    expect(
      flat.map((d) => (d.kind === "group" ? `G:${d.group.key}` : `R:${(d.row as Row).price}`)),
    ).toEqual(["G:cat:A", "R:30", "R:20", "R:50", "G:cat:B", "R:10", "R:40"]);
    expect(flat[1]).toMatchObject({ kind: "row", depth: 1 });
  });

  it("collapsed groups hide their entire subtree", () => {
    const flat = flattenGroups(buildGroups(rows, ["cat", "status"]), new Set(["cat:A"]));
    expect(flat.map((d) => (d.kind === "group" ? d.group.key : "row"))).toEqual([
      "cat:A",
      "cat:B",
      "cat:B/status:on",
      "row",
      "row",
    ]);
  });
});
