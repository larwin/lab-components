import type { Collection, Key } from "./collection";
import { keysBetween } from "./navigation";

/**
 * Selection algebra — pure set operations implementing single / multiple /
 * range selection with an anchor, exactly like a native file explorer:
 *
 *  - plain select: replace selection, move anchor
 *  - toggle (Ctrl/Cmd+click, Space in multi mode): flip one key, move anchor
 *  - extend (Shift+click / Shift+Arrow): contiguous range from anchor
 */

export type SelectionMode = "none" | "single" | "multiple";

export interface SelectionSnapshot {
  readonly selectedKeys: ReadonlySet<Key>;
  readonly anchorKey: Key | null;
}

export const EMPTY_SELECTION: SelectionSnapshot = {
  selectedKeys: new Set<Key>(),
  anchorKey: null,
};

export interface SelectInput<T> {
  collection: Collection<T>;
  visible: readonly Key[];
  mode: SelectionMode;
  key: Key;
  /** Ctrl/Cmd semantics. */
  toggle?: boolean;
  /** Shift semantics. */
  extend?: boolean;
}

const selectableKeys = <T>(collection: Collection<T>, keys: readonly Key[]): Key[] =>
  keys.filter((k) => {
    const node = collection.getNode(k);
    return node !== undefined && node.kind === "item" && !node.disabled;
  });

export function applySelect<T>(
  snapshot: SelectionSnapshot,
  { collection, visible, mode, key, toggle = false, extend = false }: SelectInput<T>,
): SelectionSnapshot {
  if (mode === "none") return snapshot;
  const node = collection.getNode(key);
  if (!node || node.disabled || node.kind !== "item") return snapshot;

  if (mode === "single") {
    const already = snapshot.selectedKeys.has(key);
    if (toggle && already) return { selectedKeys: new Set(), anchorKey: key };
    if (already && snapshot.selectedKeys.size === 1) return snapshot;
    return { selectedKeys: new Set([key]), anchorKey: key };
  }

  if (extend && snapshot.anchorKey !== null) {
    const range = selectableKeys(collection, keysBetween(visible, snapshot.anchorKey, key));
    const base = toggle ? new Set(snapshot.selectedKeys) : new Set<Key>();
    for (const k of range) base.add(k);
    // Anchor stays put during shift-extension, like every desktop UI.
    return { selectedKeys: base, anchorKey: snapshot.anchorKey };
  }

  if (toggle) {
    const next = new Set(snapshot.selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return { selectedKeys: next, anchorKey: key };
  }

  return { selectedKeys: new Set([key]), anchorKey: key };
}

export function selectAll<T>(
  collection: Collection<T>,
  visible: readonly Key[],
): SelectionSnapshot {
  const keys = selectableKeys(collection, visible);
  return { selectedKeys: new Set(keys), anchorKey: keys[0] ?? null };
}

export function clearSelection(snapshot: SelectionSnapshot): SelectionSnapshot {
  if (snapshot.selectedKeys.size === 0) return snapshot;
  return { selectedKeys: new Set(), anchorKey: snapshot.anchorKey };
}
