/**
 * Collection — the normalized item model shared by List, Tree, Menu, ComboBox,
 * CommandPalette, Grid and DataGrid rows.
 *
 * Source data of any shape is normalized once into an indexed, immutable
 * structure: every node knows its key, kind, parent, depth and children, and
 * the collection exposes O(1) lookup plus a cached *visible order* for a given
 * expansion state. Everything downstream (navigation, selection, typeahead,
 * virtualization) works on keys and indices — never on raw data or DOM.
 */

export type Key = string;

export type NodeKind = "item" | "section" | "separator";

export interface CollectionSourceNode<T> {
  key: Key;
  value: T;
  kind?: NodeKind;
  disabled?: boolean;
  /** Text used for typeahead / culture-aware search. */
  textValue?: string;
  children?: CollectionSourceNode<T>[];
}

export interface CollectionNode<T> {
  readonly key: Key;
  readonly value: T;
  readonly kind: NodeKind;
  readonly disabled: boolean;
  readonly textValue: string;
  readonly parentKey: Key | null;
  readonly depth: number;
  readonly childKeys: readonly Key[];
  readonly hasChildren: boolean;
  /** Position within siblings (aria-posinset is this + 1). */
  readonly indexInParent: number;
}

export interface Collection<T> {
  readonly size: number;
  readonly rootKeys: readonly Key[];
  /** Depth-first order of every node, regardless of expansion. */
  readonly allKeys: readonly Key[];
  getNode(key: Key): CollectionNode<T> | undefined;
  has(key: Key): boolean;
  /**
   * Depth-first order of nodes visible for a given expansion state.
   * `expandedKeys === undefined` means "everything visible" (flat lists).
   * Result is cached per expansion-set identity.
   */
  visibleKeys(expandedKeys?: ReadonlySet<Key>): readonly Key[];
}

export function createCollection<T>(source: readonly CollectionSourceNode<T>[]): Collection<T> {
  const nodes = new Map<Key, CollectionNode<T>>();
  const rootKeys: Key[] = [];
  const allKeys: Key[] = [];

  const walk = (
    items: readonly CollectionSourceNode<T>[],
    parentKey: Key | null,
    depth: number,
  ): Key[] => {
    const keys: Key[] = [];
    items.forEach((item, index) => {
      if (nodes.has(item.key)) {
        throw new Error(`Collection: duplicate key "${item.key}"`);
      }
      keys.push(item.key);
      allKeys.push(item.key);
      const childKeys = item.children?.length ? walkLater(item, depth) : [];
      nodes.set(item.key, {
        key: item.key,
        value: item.value,
        kind: item.kind ?? "item",
        disabled: item.disabled ?? false,
        textValue: item.textValue ?? String(item.value ?? ""),
        parentKey,
        depth,
        childKeys,
        hasChildren: childKeys.length > 0,
        indexInParent: index,
      });
    });
    return keys;
  };

  // Children must be walked *after* the parent is pushed to allKeys to keep
  // depth-first order, but the parent node needs its childKeys; small helper.
  const walkLater = (item: CollectionSourceNode<T>, depth: number): Key[] =>
    walk(item.children!, item.key, depth + 1);

  rootKeys.push(...walk(source, null, 0));

  let cachedExpanded: ReadonlySet<Key> | undefined | symbol = Symbol("none");
  let cachedVisible: readonly Key[] = [];

  const computeVisible = (expandedKeys?: ReadonlySet<Key>): Key[] => {
    if (!expandedKeys) return [...allKeys];
    const out: Key[] = [];
    const visit = (keys: readonly Key[]) => {
      for (const key of keys) {
        const node = nodes.get(key)!;
        out.push(key);
        if (node.hasChildren && expandedKeys.has(key)) visit(node.childKeys);
      }
    };
    visit(rootKeys);
    return out;
  };

  return {
    size: nodes.size,
    rootKeys,
    allKeys,
    getNode: (key) => nodes.get(key),
    has: (key) => nodes.has(key),
    visibleKeys(expandedKeys) {
      if (cachedExpanded !== expandedKeys) {
        cachedVisible = computeVisible(expandedKeys);
        cachedExpanded = expandedKeys;
      }
      return cachedVisible;
    },
  };
}

/** Build a flat collection from an array (lists, menus, grid rows). */
export function collectionFromArray<T>(
  items: readonly T[],
  options: {
    getKey: (item: T, index: number) => Key;
    getTextValue?: (item: T) => string;
    isDisabled?: (item: T) => boolean;
  },
): Collection<T> {
  return createCollection(
    items.map((value, index) => ({
      key: options.getKey(value, index),
      value,
      textValue: options.getTextValue?.(value),
      disabled: options.isDisabled?.(value),
    })),
  );
}
