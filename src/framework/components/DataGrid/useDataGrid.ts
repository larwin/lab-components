import { useMemo, useState } from "react";
import type { ColumnDef, SortState } from "./types";

export interface UseDataGridArgs<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  filterText?: string;
  initialSort?: SortState | null;
}

const valueOf = <T>(row: T, col: ColumnDef<T>): string | number =>
  typeof col.accessor === "function"
    ? col.accessor(row)
    : (row[col.accessor] as unknown as string | number);

/**
 * useDataGrid — headless state for sorting, filtering and selection.
 *
 * Kept separate from rendering so the same engine can power a virtualized grid,
 * an HTML table, or a canvas renderer. This is the seam future work targets.
 */
export function useDataGrid<T>({
  data,
  columns,
  getRowId,
  filterText = "",
  initialSort = null,
}: UseDataGridArgs<T>) {
  const [sort, setSort] = useState<SortState | null>(initialSort);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSort = (columnId: string) =>
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, direction: "asc" };
      if (prev.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      columns.some((col) => String(valueOf(row, col)).toLowerCase().includes(q)),
    );
  }, [data, columns, filterText]);

  const rows = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col) return filtered;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = valueOf(a, col);
      const bv = valueOf(b, col);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, columns]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(getRowId(r)));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      if (allSelected) return new Set();
      return new Set(rows.map(getRowId));
    });

  return {
    rows,
    sort,
    toggleSort,
    selected,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    totalCount: data.length,
    filteredCount: filtered.length,
  };
}
