import type { FieldAccessor } from "./query";

/**
 * Grouping — pure multi-level row grouping with per-group aggregations.
 *
 * `buildGroups` turns a (already sorted/filtered) row array into a group tree;
 * `flattenGroups` projects that tree into the flat display sequence the grid
 * virtualizes, honouring a collapsed-keys set. Both are pure and Node-tested;
 * the grid machine only stores which group keys are collapsed.
 */

export type AggregateFn = "sum" | "avg" | "min" | "max" | "count";

export interface AggregateSpec {
  readonly field: string;
  readonly fn: AggregateFn;
}

export interface GroupNode<T> {
  /** Stable path key, e.g. "category:Audio/status:active". */
  readonly key: string;
  readonly field: string;
  readonly value: unknown;
  readonly depth: number;
  /** Leaf rows under this group (all levels). */
  readonly count: number;
  readonly aggregates: Readonly<Record<string, number>>;
  readonly children: readonly GroupNode<T>[];
  readonly rows: readonly T[];
}

export type DisplayRow<T> =
  | { readonly kind: "group"; readonly group: GroupNode<T> }
  | { readonly kind: "row"; readonly row: T; readonly depth: number };

const defaultAccessor = <T>(row: T, field: string): unknown =>
  (row as Record<string, unknown>)[field];

const computeAggregates = <T>(
  rows: readonly T[],
  specs: readonly AggregateSpec[],
  accessor: FieldAccessor<T>,
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const spec of specs) {
    if (spec.fn === "count") {
      out[spec.field] = rows.length;
      continue;
    }
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let n = 0;
    for (const row of rows) {
      const value = Number(accessor(row, spec.field));
      if (Number.isNaN(value)) continue;
      sum += value;
      if (value < min) min = value;
      if (value > max) max = value;
      n++;
    }
    if (n === 0) continue;
    out[spec.field] =
      spec.fn === "sum" ? sum : spec.fn === "avg" ? sum / n : spec.fn === "min" ? min : max;
  }
  return out;
};

export interface BuildGroupsOptions<T> {
  accessor?: FieldAccessor<T>;
  aggregates?: readonly AggregateSpec[];
  /** Orders sibling groups by their value. Defaults to a numeric collator. */
  collator?: Intl.Collator;
}

export function buildGroups<T>(
  rows: readonly T[],
  groupBy: readonly string[],
  options: BuildGroupsOptions<T> = {},
): GroupNode<T>[] {
  const accessor = options.accessor ?? defaultAccessor;
  const aggregates = options.aggregates ?? [];
  const collator = options.collator ?? new Intl.Collator(undefined, { numeric: true });

  const build = (
    slice: readonly T[],
    fields: readonly string[],
    depth: number,
    parentKey: string,
  ): GroupNode<T>[] => {
    const [field, ...rest] = fields;
    const buckets = new Map<string, { value: unknown; rows: T[] }>();
    for (const row of slice) {
      const value = accessor(row, field);
      const id = String(value ?? "");
      const bucket = buckets.get(id);
      if (bucket) bucket.rows.push(row);
      else buckets.set(id, { value, rows: [row] });
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => collator.compare(a, b))
      .map(([id, bucket]) => {
        const key = parentKey ? `${parentKey}/${field}:${id}` : `${field}:${id}`;
        return {
          key,
          field,
          value: bucket.value,
          depth,
          count: bucket.rows.length,
          aggregates: computeAggregates(bucket.rows, aggregates, accessor),
          children: rest.length > 0 ? build(bucket.rows, rest, depth + 1, key) : [],
          rows: bucket.rows,
        };
      });
  };

  return groupBy.length === 0 ? [] : build(rows, groupBy, 0, "");
}

/** Project the tree into the flat, virtualizable display sequence. */
export function flattenGroups<T>(
  groups: readonly GroupNode<T>[],
  collapsedKeys: ReadonlySet<string>,
): DisplayRow<T>[] {
  const out: DisplayRow<T>[] = [];
  const visit = (nodes: readonly GroupNode<T>[]) => {
    for (const node of nodes) {
      out.push({ kind: "group", group: node });
      if (collapsedKeys.has(node.key)) continue;
      if (node.children.length > 0) visit(node.children);
      else for (const row of node.rows) out.push({ kind: "row", row, depth: node.depth + 1 });
    }
  };
  visit(groups);
  return out;
}
