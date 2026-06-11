import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "../Checkbox";
import type { ColumnDef, RowRenderer, SortState } from "./types";
import { useDataGrid } from "./useDataGrid";

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  selectable?: boolean;
  filterText?: string;
  initialSort?: SortState | null;
  /** Override the default row renderer (extension point for virtualization). */
  renderRow?: RowRenderer<T>;
  className?: string;
  maxHeight?: number;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

/**
 * DataGrid — composable tabular grid.
 *
 * Headless state comes from `useDataGrid`; presentation lives here. The default
 * row renderer can be replaced via `renderRow` without forking the component —
 * this is how a virtualized renderer will be introduced later.
 */
export function DataGrid<T>({
  data,
  columns,
  getRowId,
  selectable = false,
  filterText,
  initialSort = null,
  renderRow,
  className,
  maxHeight,
}: DataGridProps<T>) {
  const grid = useDataGrid({ data, columns, getRowId, filterText, initialSort });

  const valueOf = (row: T, col: ColumnDef<T>) =>
    typeof col.accessor === "function" ? col.accessor(row) : (row[col.accessor] as unknown);

  return (
    <div
      className={cn(
        "overflow-auto rounded-lg border border-border bg-surface",
        className,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr>
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={grid.allSelected}
                  onChange={grid.toggleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((col) => {
              const active = grid.sort?.columnId === col.id;
              return (
                <th
                  key={col.id}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "px-3 py-2.5 font-medium text-muted-foreground",
                    alignClass[col.align ?? "left"],
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => grid.toggleSort(col.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 transition-colors hover:text-foreground",
                        active && "text-foreground",
                      )}
                    >
                      {col.header}
                      {!active && <ChevronsUpDown className="size-3.5 opacity-50" />}
                      {active &&
                        (grid.sort?.direction === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        ))}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, rowIndex) => {
            const id = getRowId(row);
            const selected = grid.selected.has(id);
            if (renderRow) {
              return renderRow({
                row,
                rowIndex,
                columns,
                selected,
                onToggleSelect: grid.toggleSelect,
              });
            }
            return (
              <tr
                key={id}
                className={cn(
                  "border-t border-border transition-colors hover:bg-muted/50",
                  selected && "bg-accent/40",
                )}
              >
                {selectable && (
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected}
                      onChange={() => grid.toggleSelect(id)}
                      aria-label={`Select row ${id}`}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn("px-3 py-2", alignClass[col.align ?? "left"])}
                  >
                    {col.cell ? col.cell(row) : String(valueOf(row, col))}
                  </td>
                ))}
              </tr>
            );
          })}
          {grid.rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="px-3 py-10 text-center text-muted-foreground"
              >
                No rows match the current filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
