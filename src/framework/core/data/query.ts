/**
 * Query — pure, composable data operations for grids and collections.
 * Client-side today; the same SortSpec/FilterSpec descriptors are designed to
 * be serialized to a server (they are plain data), so switching to server-side
 * sort/filter changes the executor, not the component.
 */

export type SortDirection = "asc" | "desc";

export interface SortSpec {
  readonly field: string;
  readonly direction: SortDirection;
}

export type FieldAccessor<T> = (row: T, field: string) => unknown;

const defaultAccessor = <T>(row: T, field: string): unknown =>
  (row as Record<string, unknown>)[field];

const compareValues = (a: unknown, b: unknown, collator: Intl.Collator): number => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return collator.compare(String(a), String(b));
};

/** Multi-column, culture-aware, stable sort. Returns a new array. */
export function sortRows<T>(
  rows: readonly T[],
  specs: readonly SortSpec[],
  options: { collator?: Intl.Collator; accessor?: FieldAccessor<T> } = {},
): T[] {
  if (specs.length === 0) return [...rows];
  const collator = options.collator ?? new Intl.Collator(undefined, { numeric: true });
  const accessor = options.accessor ?? defaultAccessor;
  const indexed = rows.map((row, index) => ({ row, index }));
  indexed.sort((x, y) => {
    for (const spec of specs) {
      const cmp = compareValues(accessor(x.row, spec.field), accessor(y.row, spec.field), collator);
      if (cmp !== 0) return spec.direction === "asc" ? cmp : -cmp;
    }
    return x.index - y.index; // stability
  });
  return indexed.map((e) => e.row);
}

/** Toggle cycle for column headers: none -> asc -> desc -> none. */
export function toggleSort(
  specs: readonly SortSpec[],
  field: string,
  additive: boolean,
): SortSpec[] {
  const existing = specs.find((s) => s.field === field);
  const others = additive ? specs.filter((s) => s.field !== field) : [];
  if (!existing) return [...others, { field, direction: "asc" }];
  if (existing.direction === "asc") return [...others, { field, direction: "desc" }];
  return others;
}

/** Case/diacritic-insensitive global text filter across the given fields. */
export function filterRows<T>(
  rows: readonly T[],
  query: string,
  fields: readonly string[],
  options: { accessor?: FieldAccessor<T>; locale?: string } = {},
): readonly T[] {
  const q = query.trim();
  if (!q) return rows;
  const accessor = options.accessor ?? defaultAccessor;
  const combining = new RegExp("[\\u0300-\\u036f]", "g");
  const normalize = (s: string) => s.normalize("NFD").replace(combining, "").toLowerCase();
  const needle = normalize(q);
  return rows.filter((row) =>
    fields.some((field) => normalize(String(accessor(row, field) ?? "")).includes(needle)),
  );
}
