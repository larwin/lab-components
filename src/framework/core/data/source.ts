import { filterRows, sortRows, type SortSpec } from "./query";

/**
 * DataSource — the seam between collections and *where data actually lives*.
 *
 * A source is one async function taking a serializable DataQuery and an
 * AbortSignal. Swapping client-side data for a REST endpoint, a GraphQL
 * server or a streaming backend changes the source, never the component:
 * sort/filter descriptors travel inside the query either way.
 */

export interface DataQuery {
  readonly sort: readonly SortSpec[];
  /** Global text filter (per-column filter specs slot in here later). */
  readonly filter: string;
  /** Opaque pagination cursor; null requests the first page. */
  readonly cursor: string | null;
  readonly limit: number;
}

export interface DataPage<T> {
  readonly items: readonly T[];
  /** Cursor for the next page; null means the end was reached. */
  readonly nextCursor: string | null;
  /** Total matching rows when the backend knows it. */
  readonly total?: number;
}

export type DataSource<T> = (query: DataQuery, signal: AbortSignal) => Promise<DataPage<T>>;

export interface ArraySourceOptions<T> {
  /** Fields the global filter searches. */
  filterFields: readonly string[];
  accessor?: (row: T, field: string) => unknown;
  /** Simulated network latency in ms (deterministic or randomized by caller). */
  latency?: () => number;
}

/**
 * Wraps an in-memory array as a DataSource with *server-like* semantics:
 * sorting and filtering are applied source-side, pagination is cursor-based,
 * and the optional latency makes races and cancellation reproducible in demos
 * and tests. Cursors are stringified offsets.
 */
export function arraySource<T>(
  rows: readonly T[],
  { filterFields, accessor, latency }: ArraySourceOptions<T>,
): DataSource<T> {
  return async (query, signal) => {
    const wait = latency?.() ?? 0;
    if (wait > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, wait);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(
              signal.reason instanceof Error
                ? signal.reason
                : new DOMException("Aborted", "AbortError"),
            );
          },
          { once: true },
        );
      });
    }
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const filtered = filterRows(rows, query.filter, filterFields, { accessor });
    const sorted = sortRows(filtered, query.sort, { accessor });
    const offset = query.cursor === null ? 0 : Number(query.cursor);
    const items = sorted.slice(offset, offset + query.limit);
    const next = offset + query.limit;
    return {
      items,
      nextCursor: next < sorted.length ? String(next) : null,
      total: sorted.length,
    };
  };
}
