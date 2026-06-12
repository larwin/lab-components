// @vitest-environment node
// Pure core: keyboard system tested without DOM or browser.
import { describe, expect, it, vi } from "vitest";
import {
  flipHorizontalStroke,
  formatKeyCombo,
  matchesCombo,
  parseKeyCombo,
  type KeyStroke,
} from "./keys";
import { createShortcutManager, ROOT_SCOPE } from "./shortcuts";

const stroke = (key: string, mods: Partial<KeyStroke> = {}): KeyStroke => ({
  key,
  ctrl: false,
  meta: false,
  alt: false,
  shift: false,
  ...mods,
});

describe("key combos", () => {
  it("parses modifiers case-insensitively and the Space alias", () => {
    expect(parseKeyCombo("Mod+Shift+K")).toMatchObject({ key: "k", shift: true, mod: true });
    expect(parseKeyCombo("ctrl+alt+Enter")).toMatchObject({ key: "Enter", ctrl: true, alt: true });
    expect(parseKeyCombo("Shift+Space")).toMatchObject({ key: " ", shift: true });
  });

  it("resolves Mod per platform", () => {
    const combo = parseKeyCombo("Mod+k");
    expect(matchesCombo(stroke("k", { meta: true }), combo, "mac")).toBe(true);
    expect(matchesCombo(stroke("k", { ctrl: true }), combo, "mac")).toBe(false);
    expect(matchesCombo(stroke("k", { ctrl: true }), combo, "windows")).toBe(true);
  });

  it("requires exact modifier sets", () => {
    const combo = parseKeyCombo("ArrowDown");
    expect(matchesCombo(stroke("ArrowDown"), combo)).toBe(true);
    expect(matchesCombo(stroke("ArrowDown", { shift: true }), combo)).toBe(false);
  });

  it("formats for display per platform", () => {
    expect(formatKeyCombo("Mod+Shift+K", "mac")).toBe("⇧⌘K");
    expect(formatKeyCombo("Mod+Shift+K", "windows")).toBe("Ctrl+Shift+K");
  });

  it("flips horizontal arrows in RTL only, preserving modifiers", () => {
    expect(flipHorizontalStroke(stroke("ArrowLeft"), "rtl").key).toBe("ArrowRight");
    expect(flipHorizontalStroke(stroke("ArrowRight", { shift: true }), "rtl")).toMatchObject({
      key: "ArrowLeft",
      shift: true,
    });
    expect(flipHorizontalStroke(stroke("ArrowLeft"), "ltr").key).toBe("ArrowLeft");
    expect(flipHorizontalStroke(stroke("ArrowDown"), "rtl").key).toBe("ArrowDown");
    expect(flipHorizontalStroke(stroke("Home"), "rtl").key).toBe("Home");
  });
});

describe("shortcut scopes & priorities", () => {
  it("global shortcuts fire from the root scope", () => {
    const manager = createShortcutManager("windows");
    const run = vi.fn();
    manager.register({ keys: "Mod+s", run });
    expect(manager.handle(stroke("s", { ctrl: true }))).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("the deepest active scope wins over ancestors", () => {
    const manager = createShortcutManager();
    const rootRun = vi.fn();
    const pageRun = vi.fn();
    manager.defineScope({ id: "page" });
    manager.register({ keys: "Enter", run: rootRun });
    manager.register({ keys: "Enter", scopeId: "page", run: pageRun });
    const pop = manager.activate("page");
    manager.handle(stroke("Enter"));
    expect(pageRun).toHaveBeenCalledTimes(1);
    expect(rootRun).not.toHaveBeenCalled();
    pop();
    manager.handle(stroke("Enter"));
    expect(rootRun).toHaveBeenCalledTimes(1);
  });

  it("falls through to ancestors when the active scope has no match", () => {
    const manager = createShortcutManager();
    const rootRun = vi.fn();
    manager.defineScope({ id: "page" });
    manager.register({ keys: "Mod+k", run: rootRun });
    manager.activate("page");
    manager.handle(stroke("k", { ctrl: true }));
    expect(rootRun).toHaveBeenCalledTimes(1);
  });

  it("blocking scopes (modal overlays) mask everything outside", () => {
    const manager = createShortcutManager();
    const pageRun = vi.fn();
    manager.defineScope({ id: "dialog", blocking: true });
    manager.register({ keys: "Mod+k", run: pageRun }); // on root
    manager.activate("dialog");
    expect(manager.handle(stroke("k", { ctrl: true }))).toBe(false);
    expect(pageRun).not.toHaveBeenCalled();
  });

  it("text-capturing scopes swallow printable keys but not combos", () => {
    const manager = createShortcutManager();
    const printable = vi.fn();
    const combo = vi.fn();
    manager.defineScope({ id: "field", capturesText: true });
    manager.register({ keys: "k", run: printable }); // root, plain letter
    manager.register({ keys: "Mod+k", run: combo }); // root, combo
    manager.activate("field");
    expect(manager.handle(stroke("k"))).toBe(false); // swallowed → types into the field
    expect(printable).not.toHaveBeenCalled();
    expect(manager.handle(stroke("k", { ctrl: true }))).toBe(true);
    expect(combo).toHaveBeenCalled();
  });

  it("higher priority wins inside a scope; conflicts are reported", () => {
    const manager = createShortcutManager();
    const low = vi.fn();
    const high = vi.fn();
    manager.register({ keys: "Mod+p", priority: 0, run: low });
    manager.register({ keys: "Mod+p", priority: 10, run: high });
    manager.handle(stroke("p", { ctrl: true }));
    expect(high).toHaveBeenCalled();
    expect(low).not.toHaveBeenCalled();
    expect(manager.getConflicts()).toHaveLength(0); // different priorities → resolved

    manager.register({ keys: "Mod+p", priority: 10, run: vi.fn() });
    const conflicts = manager.getConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].scopeId).toBe(ROOT_SCOPE);
  });

  it("`when` predicates make shortcuts contextual", () => {
    const manager = createShortcutManager();
    let editing = false;
    const run = vi.fn();
    manager.register({ keys: "e", when: () => !editing, run });
    editing = true;
    expect(manager.handle(stroke("e"))).toBe(false);
    editing = false;
    expect(manager.handle(stroke("e"))).toBe(true);
  });
});
