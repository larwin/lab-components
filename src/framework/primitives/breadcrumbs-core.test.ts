// @vitest-environment node
import { describe, expect, it } from "vitest";
import { collapseBreadcrumbs } from "./breadcrumbs-core";

const path = (n: number) => Array.from({ length: n }, (_, i) => `seg-${i + 1}`);

describe("collapseBreadcrumbs — overflow policy", () => {
  it("keeps everything within the budget", () => {
    expect(collapseBreadcrumbs(path(4), 4)).toEqual({
      head: path(4),
      collapsed: [],
      tail: [],
    });
  });

  it("never collapses a single segment (the menu would cost more)", () => {
    // 5 segments, budget 4: collapsing would hide exactly one — keep all.
    expect(collapseBreadcrumbs(path(5), 4).collapsed).toEqual([]);
  });

  it("keeps the root and the last maxVisible-2 segments, folds the middle", () => {
    const result = collapseBreadcrumbs(path(8), 4);
    expect(result.head).toEqual(["seg-1"]);
    expect(result.collapsed).toEqual(["seg-2", "seg-3", "seg-4", "seg-5", "seg-6"]);
    expect(result.tail).toEqual(["seg-7", "seg-8"]);
  });

  it("clamps maxVisible to at least 3", () => {
    const result = collapseBreadcrumbs(path(10), 1);
    expect(result.head).toEqual(["seg-1"]);
    expect(result.tail).toEqual(["seg-10"]); // budget 3 → 1 segment of tail
    expect(result.collapsed).toHaveLength(8);
  });
});
