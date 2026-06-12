// @vitest-environment node
// Pure core: these tests run without DOM, browser or React.
import { describe, expect, it } from "vitest";
import { collectionFromArray, createCollection } from "./collection";
import { firstKey, keysBetween, lastKey, nextKey, pageKey, previousKey } from "./navigation";
import { EMPTY_SELECTION, applySelect, selectAll } from "./selection";
import { createSearchCollator, typeaheadStep, EMPTY_TYPEAHEAD } from "./typeahead";

const tree = createCollection([
  {
    key: "docs",
    value: "Documents",
    children: [
      { key: "cv", value: "CV.pdf" },
      { key: "notes", value: "Notes.md", disabled: true },
    ],
  },
  { key: "pics", value: "Pictures", children: [{ key: "cat", value: "cat.png" }] },
  { key: "readme", value: "README" },
]);

const flat = collectionFromArray(["Élodie", "Anna", "Étienne", "Bob", "anders"], {
  getKey: (name) => name,
  getTextValue: (name) => name,
});

describe("collection normalization", () => {
  it("indexes nodes with depth, parent and DFS order", () => {
    expect(tree.size).toBe(6);
    expect(tree.allKeys).toEqual(["docs", "cv", "notes", "pics", "cat", "readme"]);
    expect(tree.getNode("cv")).toMatchObject({ parentKey: "docs", depth: 1, indexInParent: 0 });
    expect(tree.getNode("docs")).toMatchObject({ hasChildren: true, depth: 0 });
  });

  it("computes visibility from expansion state", () => {
    expect(tree.visibleKeys(new Set())).toEqual(["docs", "pics", "readme"]);
    expect(tree.visibleKeys(new Set(["pics"]))).toEqual(["docs", "pics", "cat", "readme"]);
    expect(tree.visibleKeys(undefined)).toEqual(tree.allKeys);
  });

  it("rejects duplicate keys loudly", () => {
    expect(() =>
      createCollection([
        { key: "a", value: 1 },
        { key: "a", value: 2 },
      ]),
    ).toThrow(/duplicate key/);
  });
});

describe("navigation", () => {
  const visible = tree.visibleKeys(new Set(["docs"])); // docs, cv, notes, pics, readme

  it("moves through visible items, skipping disabled ones", () => {
    expect(nextKey(tree, visible, "docs")).toBe("cv");
    expect(nextKey(tree, visible, "cv")).toBe("pics"); // "notes" is disabled
    expect(previousKey(tree, visible, "pics")).toBe("cv");
  });

  it("handles boundaries with and without wrap", () => {
    expect(nextKey(tree, visible, "readme")).toBeNull();
    expect(nextKey(tree, visible, "readme", { wrap: true })).toBe("docs");
    expect(firstKey(tree, visible)).toBe("docs");
    expect(lastKey(tree, visible)).toBe("readme");
  });

  it("jumps by pages and clamps at the edges", () => {
    // docs(0) + 2 lands on disabled "notes" → scans forward to "pics"
    expect(pageKey(tree, visible, "docs", 2, 1)).toBe("pics");
    expect(pageKey(tree, visible, "cv", 100, 1)).toBe("readme");
    expect(pageKey(tree, visible, "pics", 100, -1)).toBe("docs");
  });

  it("computes inclusive ranges in either direction", () => {
    expect(keysBetween(visible, "cv", "pics")).toEqual(["cv", "notes", "pics"]);
    expect(keysBetween(visible, "pics", "cv")).toEqual(["cv", "notes", "pics"]);
  });
});

describe("selection algebra", () => {
  const visible = flat.visibleKeys();

  it("replaces in single mode", () => {
    let s = applySelect(EMPTY_SELECTION, {
      collection: flat,
      visible,
      mode: "single",
      key: "Anna",
    });
    s = applySelect(s, { collection: flat, visible, mode: "single", key: "Bob" });
    expect([...s.selectedKeys]).toEqual(["Bob"]);
  });

  it("toggles in multiple mode and keeps the anchor", () => {
    let s = applySelect(EMPTY_SELECTION, {
      collection: flat,
      visible,
      mode: "multiple",
      key: "Anna",
    });
    s = applySelect(s, { collection: flat, visible, mode: "multiple", key: "Bob", toggle: true });
    expect(s.selectedKeys.has("Anna")).toBe(true);
    expect(s.selectedKeys.has("Bob")).toBe(true);
    s = applySelect(s, { collection: flat, visible, mode: "multiple", key: "Bob", toggle: true });
    expect(s.selectedKeys.has("Bob")).toBe(false);
  });

  it("extends a contiguous range from the anchor (shift semantics)", () => {
    let s = applySelect(EMPTY_SELECTION, {
      collection: flat,
      visible,
      mode: "multiple",
      key: "Anna",
    });
    s = applySelect(s, { collection: flat, visible, mode: "multiple", key: "Bob", extend: true });
    expect([...s.selectedKeys]).toEqual(["Anna", "Étienne", "Bob"]);
    expect(s.anchorKey).toBe("Anna"); // anchor does not move while extending
    // Re-extend the other way from the same anchor
    s = applySelect(s, {
      collection: flat,
      visible,
      mode: "multiple",
      key: "Élodie",
      extend: true,
    });
    expect([...s.selectedKeys]).toEqual(["Élodie", "Anna"]);
  });

  it("selects all selectable items", () => {
    const s = selectAll(flat, visible);
    expect(s.selectedKeys.size).toBe(5);
  });

  it("never selects disabled items", () => {
    const visibleTree = tree.visibleKeys(new Set(["docs"]));
    const s = applySelect(EMPTY_SELECTION, {
      collection: tree,
      visible: visibleTree,
      mode: "multiple",
      key: "notes",
    });
    expect(s.selectedKeys.size).toBe(0);
  });
});

describe("culture-aware typeahead", () => {
  const visible = flat.visibleKeys();
  const collator = createSearchCollator("fr");

  it("matches base characters across diacritics ('e' finds 'Élodie')", () => {
    const { matchKey } = typeaheadStep(EMPTY_TYPEAHEAD, {
      collection: flat,
      visible,
      focusedKey: null,
      char: "e",
      now: 0,
      collator,
    });
    expect(matchKey).toBe("Élodie");
  });

  it("cycles through matches on repeated single character", () => {
    const r1 = typeaheadStep(EMPTY_TYPEAHEAD, {
      collection: flat,
      visible,
      focusedKey: "Anna",
      char: "a",
      now: 0,
      collator,
    });
    expect(r1.matchKey).toBe("anders");
    const r2 = typeaheadStep(r1.state, {
      collection: flat,
      visible,
      focusedKey: r1.matchKey,
      char: "a",
      now: 100,
      collator,
    });
    expect(r2.matchKey).toBe("Anna"); // wrapped
  });

  it("builds a prefix query within the timeout, resets after it", () => {
    const r1 = typeaheadStep(EMPTY_TYPEAHEAD, {
      collection: flat,
      visible,
      focusedKey: null,
      char: "e",
      now: 0,
      collator,
    });
    const r2 = typeaheadStep(r1.state, {
      collection: flat,
      visible,
      focusedKey: r1.matchKey,
      char: "t",
      now: 200,
      collator,
    });
    expect(r2.matchKey).toBe("Étienne"); // "et" prefix, keeps building
    const r3 = typeaheadStep(r2.state, {
      collection: flat,
      visible,
      focusedKey: r2.matchKey,
      char: "b",
      now: 5000,
      collator,
    });
    expect(r3.matchKey).toBe("Bob"); // buffer expired → fresh search
  });
});
