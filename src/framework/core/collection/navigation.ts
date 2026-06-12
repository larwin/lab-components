import type { Collection, Key } from "./collection";

/**
 * Navigation — pure key-order arithmetic over a collection's visible sequence.
 * No DOM focus here: these functions compute *which key* should be focused;
 * the Navigable behavior turns the answer into state + focus/scroll effects.
 */

export interface NavigateOptions {
  wrap?: boolean;
  skipDisabled?: boolean;
}

const isNavigable = <T>(collection: Collection<T>, key: Key, skipDisabled: boolean): boolean => {
  const node = collection.getNode(key);
  if (!node || node.kind !== "item") return false;
  return !(skipDisabled && node.disabled);
};

function scan<T>(
  collection: Collection<T>,
  visible: readonly Key[],
  start: number,
  step: 1 | -1,
  { wrap = false, skipDisabled = true }: NavigateOptions,
): Key | null {
  const count = visible.length;
  if (count === 0) return null;
  let index = start;
  for (let i = 0; i < count; i++) {
    if (wrap) index = (index + count) % count;
    if (index < 0 || index >= count) return null;
    if (isNavigable(collection, visible[index], skipDisabled)) return visible[index];
    index += step;
  }
  return null;
}

export function firstKey<T>(
  collection: Collection<T>,
  visible: readonly Key[],
  options: NavigateOptions = {},
): Key | null {
  return scan(collection, visible, 0, 1, { ...options, wrap: false });
}

export function lastKey<T>(
  collection: Collection<T>,
  visible: readonly Key[],
  options: NavigateOptions = {},
): Key | null {
  return scan(collection, visible, visible.length - 1, -1, { ...options, wrap: false });
}

export function nextKey<T>(
  collection: Collection<T>,
  visible: readonly Key[],
  from: Key | null,
  options: NavigateOptions = {},
): Key | null {
  if (from === null) return firstKey(collection, visible, options);
  const index = visible.indexOf(from);
  if (index === -1) return firstKey(collection, visible, options);
  return scan(collection, visible, index + 1, 1, options);
}

export function previousKey<T>(
  collection: Collection<T>,
  visible: readonly Key[],
  from: Key | null,
  options: NavigateOptions = {},
): Key | null {
  if (from === null) return lastKey(collection, visible, options);
  const index = visible.indexOf(from);
  if (index === -1) return lastKey(collection, visible, options);
  return scan(collection, visible, index - 1, -1, options);
}

/** Jump by a page of `pageSize` items (PageUp / PageDown). */
export function pageKey<T>(
  collection: Collection<T>,
  visible: readonly Key[],
  from: Key | null,
  pageSize: number,
  direction: 1 | -1,
  options: NavigateOptions = {},
): Key | null {
  if (from === null) {
    return direction === 1
      ? firstKey(collection, visible, options)
      : lastKey(collection, visible, options);
  }
  const index = visible.indexOf(from);
  if (index === -1) return firstKey(collection, visible, options);
  const target = Math.max(0, Math.min(visible.length - 1, index + pageSize * direction));
  return scan(collection, visible, target, direction, { ...options, wrap: false });
}

/** All keys between two keys in visible order, inclusive (range selection). */
export function keysBetween(visible: readonly Key[], a: Key, b: Key): Key[] {
  const ia = visible.indexOf(a);
  const ib = visible.indexOf(b);
  if (ia === -1 || ib === -1) return [];
  const [start, end] = ia <= ib ? [ia, ib] : [ib, ia];
  return visible.slice(start, end + 1);
}
