import { type ReactNode } from "react";

/**
 * DataGrid type contracts.
 *
 * These types are the stable surface the rest of the app codes against. The
 * grid's *implementation* (row renderer, cell renderer, sort/filter engines)
 * can be swapped freely as long as these contracts hold.
 */

export type SortDirection = "asc" | "desc";

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

export interface ColumnDef<T> {
  /** Stable column identifier. */
  id: string;
  /** Header label. */
  header: ReactNode;
  /** Key on the row, or a function deriving the comparable/displayed value. */
  accessor: keyof T | ((row: T) => string | number);
  /** Optional custom cell renderer — the extension point for cell evolution. */
  cell?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Fixed width in px; omit for flexible. */
  width?: number;
  sortable?: boolean;
}

/** A row renderer can be replaced to introduce virtualization, grouping, etc. */
export type RowRenderer<T> = (props: {
  row: T;
  rowIndex: number;
  columns: ColumnDef<T>[];
  selected: boolean;
  onToggleSelect?: (id: string) => void;
}) => ReactNode;

export interface DataGridOptions {
  selectable?: boolean;
  filterText?: string;
}
