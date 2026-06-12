import {
  createCollection,
  focusable,
  navigable,
  type Collection,
  type CollectionSourceNode,
  type Key,
} from "@/framework/core";
import type { ReactNode } from "react";

/**
 * Toolbar recipe — APG toolbar over the existing machines, zero new behavior:
 * the bar is [Focusable + Navigable(horizontal, wrap)] whose `scrollToItem`
 * effect is reinterpreted as DOM focus on real buttons (the Accordion
 * pattern); the "…" overflow is the untouched Menu machine; which items
 * overflow is the pure `partitionOverflow` policy (core/layout) fed with
 * measured widths.
 *
 * This module is the pure half of the primitive: definitions → collection,
 * and definitions → overflow-menu entries, both Node-testable.
 */

export interface ToolbarButtonDef {
  kind: "button";
  key: Key;
  label: string;
  icon?: ReactNode;
  /** Icon-only by default; set to render the label next to the icon. */
  showLabel?: boolean;
  /** Disabled toolbar items stay focusable (APG: no navigation hole). */
  disabled?: boolean;
  /** Global shortcut — stays active even while overflowed (item stays mounted). */
  shortcut?: string;
  /** Higher priority stays visible longer when the toolbar shrinks. */
  overflowPriority?: number;
  onPress?: () => void;
}

export interface ToolbarToggleDef {
  key: Key;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  shortcut?: string;
}

export interface ToolbarToggleGroupDef {
  kind: "toggle-group";
  key: Key;
  /** Group label — aria-label of the role=group and overflow section title. */
  label: string;
  mode?: "single" | "multiple";
  items: readonly ToolbarToggleDef[];
  /** Controlled value (set of pressed keys, even in single mode). */
  value?: readonly Key[];
  defaultValue?: readonly Key[];
  onValueChange?: (value: Key[]) => void;
  overflowPriority?: number;
}

export interface ToolbarSelectOptionDef {
  key: Key;
  label: string;
  disabled?: boolean;
}

export interface ToolbarSelectDef {
  kind: "select";
  key: Key;
  /** aria-label of the trigger and overflow section title. */
  label: string;
  options: readonly ToolbarSelectOptionDef[];
  value?: Key | null;
  defaultValue?: Key;
  onValueChange?: (value: Key | null) => void;
  overflowPriority?: number;
}

export interface ToolbarSeparatorDef {
  kind: "separator";
  key: Key;
}

export type ToolbarItemDef =
  | ToolbarButtonDef
  | ToolbarToggleGroupDef
  | ToolbarSelectDef
  | ToolbarSeparatorDef;

export const toolbarBehaviors = [focusable, navigable] as const;

/** Reserved key of the "…" trigger inside the toolbar collection. */
export const OVERFLOW_TRIGGER_KEY = "__toolbar-overflow";

/**
 * Build the navigable collection from the defs still visible in the row.
 * Toggle groups flatten: each toggle is a toolbar stop of its own (APG —
 * arrows traverse every control). Separators are non-item nodes (skipped).
 * Disabled controls are NOT flagged disabled here: they must stay reachable;
 * activation is gated at the rendering edge instead.
 */
export function toolbarCollection(
  defs: readonly ToolbarItemDef[],
  overflowKeys: ReadonlySet<Key>,
  hasOverflow: boolean,
): Collection<ToolbarItemDef | ToolbarToggleDef | string> {
  const source: CollectionSourceNode<ToolbarItemDef | ToolbarToggleDef | string>[] = [];
  for (const def of defs) {
    if (overflowKeys.has(def.key)) continue;
    switch (def.kind) {
      case "button":
      case "select":
        source.push({ key: def.key, value: def, textValue: def.label });
        break;
      case "toggle-group":
        source.push({
          key: `__group-${def.key}`,
          value: def,
          kind: "section",
          children: def.items.map((item) => ({
            key: item.key,
            value: item,
            textValue: item.label,
          })),
        });
        break;
      case "separator":
        source.push({ key: def.key, value: def, kind: "separator" });
        break;
    }
  }
  if (hasOverflow) {
    source.push({ key: OVERFLOW_TRIGGER_KEY, value: "…", textValue: "" });
  }
  return createCollection(source);
}

/* ------------------------------------------------------------------ */
/* Overflow menu projection                                            */
/* ------------------------------------------------------------------ */

export interface OverflowMenuEntry {
  /** Unique key inside the overflow menu (options are namespaced per def). */
  menuKey: Key;
  /** Routing: which def owns the entry… */
  defKey: Key;
  /** …and which inner key was activated (toggle item / select option). */
  itemKey?: Key;
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

export interface OverflowMenuSection {
  label?: string;
  entries: OverflowMenuEntry[];
}

/**
 * Project overflowed defs onto menu sections, document order preserved.
 * Buttons accumulate into unlabeled sections; each toggle group / select
 * becomes a labeled section whose current value shows as `selected` (the
 * shell renders it as a check). `values` carries the live machine state of
 * groups and selects, keyed by def key.
 */
export function overflowMenuSections(
  defs: readonly ToolbarItemDef[],
  overflowKeys: ReadonlySet<Key>,
  values: ReadonlyMap<Key, readonly Key[]>,
): OverflowMenuSection[] {
  const sections: OverflowMenuSection[] = [];
  let buttonRun: OverflowMenuEntry[] | null = null;

  const flushButtons = () => {
    buttonRun = null;
  };

  for (const def of defs) {
    if (!overflowKeys.has(def.key)) continue;
    switch (def.kind) {
      case "button": {
        if (!buttonRun) {
          buttonRun = [];
          sections.push({ entries: buttonRun });
        }
        buttonRun.push({
          menuKey: def.key,
          defKey: def.key,
          label: def.label,
          icon: def.icon,
          disabled: def.disabled,
          shortcut: def.shortcut,
        });
        break;
      }
      case "toggle-group": {
        flushButtons();
        const pressed = new Set(values.get(def.key) ?? []);
        sections.push({
          label: def.label,
          entries: def.items.map((item) => ({
            menuKey: item.key,
            defKey: def.key,
            itemKey: item.key,
            label: item.label,
            icon: item.icon,
            selected: pressed.has(item.key),
            disabled: item.disabled,
            shortcut: item.shortcut,
          })),
        });
        break;
      }
      case "select": {
        flushButtons();
        const selected = new Set(values.get(def.key) ?? []);
        sections.push({
          label: def.label,
          entries: def.options.map((option) => ({
            menuKey: `${def.key}::${option.key}`,
            defKey: def.key,
            itemKey: option.key,
            label: option.label,
            selected: selected.has(option.key),
            disabled: option.disabled,
          })),
        });
        break;
      }
      case "separator":
        // Separators never overflow (partitionOverflow guarantees it).
        break;
    }
  }
  return sections;
}

/** Measurable row entries for `partitionOverflow` (priority + separator kind). */
export function toolbarOverflowItems(
  defs: readonly ToolbarItemDef[],
  widthOf: (key: Key) => number,
): { key: string; width: number; priority?: number; kind?: "item" | "separator" }[] {
  return defs.map((def) => ({
    key: def.key,
    width: widthOf(def.key),
    priority: def.kind === "separator" ? undefined : def.overflowPriority,
    kind: def.kind === "separator" ? ("separator" as const) : ("item" as const),
  }));
}
