import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildGroups,
  flattenGroups,
  scrollToItem,
  type AggregateFn,
  type DisplayRow,
  type GroupNode,
  type Key,
} from "@/framework/core";
import { filterRows, sortRows, type SortSpec } from "@/framework/core/data/query";
import {
  announceNow,
  useForgeEffects,
  useKeymap,
  useLiveRef,
  useMachine,
  useVirtualizer,
} from "@/framework/react";
import {
  GRID_KEYMAP,
  clipboardCopy,
  createGridMachine,
  effectiveColumnOrder,
  gridIntents,
  type GridState,
} from "./gridMachine";

/**
 * DataGrid — a *specialization of the collection engine*, not an island:
 * the grid machine owns cursor/selection/sort as pure state, `sortRows` /
 * `filterRows` are pure core functions, rows render through the Fenwick
 * virtualizer, and the keyboard map is declarative. 100k+ rows by design.
 */

export interface GridColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => unknown;
  /** Field name used by the sort spec; defaults to `id`. */
  field?: string;
  sortable?: boolean;
  /** Inline editing (requires onCellEdit on the grid). */
  editable?: boolean;
  width?: number;
  /** Disable drag-resize / drag-reorder / pinning for this column. */
  fixed?: boolean;
  /** Aggregate shown on group rows when the grid is grouped. */
  aggregate?: AggregateFn;
  align?: "left" | "right" | "center";
  cell?: (row: T) => ReactNode;
}

export interface DataGridProps<T> {
  data: readonly T[];
  columns: GridColumn<T>[];
  getRowId: (row: T) => Key;
  filterText?: string;
  selectionMode?: "none" | "single" | "multiple";
  onSelectionChange?: (keys: ReadonlySet<Key>) => void;
  onVisibleRowsChange?: (count: number) => void;
  /**
   * Server mode: when false, the grid does NOT sort/filter locally — it
   * renders `data` as-is and reports sort-spec changes through `onSortChange`
   * (typically wired to a useDataSource loader). Default true.
   */
  clientQuery?: boolean;
  onSortChange?: (sort: readonly SortSpec[]) => void;
  /** Infinite scroll: fired when the visible window nears the end of `data`. */
  onApproachEnd?: () => void;
  /** Rows from the end that trigger onApproachEnd. Default 30. */
  approachThreshold?: number;
  /**
   * Inline editing: commit handler. The grid never mutates `data` — apply the
   * change upstream (controlled data). Enables F2 / Enter / type-to-edit /
   * double-click on columns with `editable: true`, plus TSV paste.
   */
  onCellEdit?: (rowKey: Key, columnId: string, value: string, row: T) => void;
  /** Group rows by these fields (client mode). Headers show column aggregates. */
  groupBy?: readonly string[];
  rowHeight?: number;
  height?: number;
  className?: string;
  "aria-label": string;
}

export function DataGrid<T>(props: DataGridProps<T>) {
  const {
    data,
    columns,
    getRowId,
    filterText = "",
    selectionMode = "multiple",
    clientQuery = true,
    approachThreshold = 30,
    rowHeight = 40,
    height = 480,
    className,
  } = props;

  const baseId = useId();

  // The machine reads geometry through a live ref: sorting/filtering can
  // change the row universe — and column ops change the visual order —
  // without rebuilding the machine. Column indices are *visual* indices.
  const live = useLiveRef({
    props,
    rows: [] as readonly T[],
    /** Flat display sequence when grouped, else null (rows render directly). */
    display: null as DisplayRow<T>[] | null,
    effective: columns as readonly GridColumn<T>[],
  });

  // Row-universe accessors shared by the machine config and rendering: when
  // grouped, indices address the flat display sequence (groups + leaves).
  const universe = {
    count: () => live.current.display?.length ?? live.current.rows.length,
    leafAt: (i: number): T | undefined => {
      const { display, rows } = live.current;
      if (!display) return rows[i];
      const entry = display[i];
      return entry?.kind === "row" ? entry.row : undefined;
    },
    groupAt: (i: number): GroupNode<T> | undefined => {
      const entry = live.current.display?.[i];
      return entry?.kind === "group" ? entry.group : undefined;
    },
    keyAt: (i: number): Key => {
      const group = universe.groupAt(i);
      if (group) return group.key;
      const leaf = universe.leafAt(i);
      return leaf !== undefined ? live.current.props.getRowId(leaf) : `__missing-${i}`;
    },
  };

  const { state, dispatch, store } = useMachine(() =>
    createGridMachine({
      rowCount: () => universe.count(),
      colCount: () => live.current.effective.length,
      getRowKey: (i) => universe.keyAt(i),
      getColumnIds: () => live.current.props.columns.map((c) => c.id),
      getSortField: (i) => {
        const col = live.current.effective[i];
        return col?.sortable ? (col.field ?? col.id) : null;
      },
      get selectionMode() {
        return live.current.props.selectionMode ?? "multiple";
      },
      isGroupRow: (i) => universe.groupAt(i) !== undefined,
      isCellEditable: (r, c) =>
        live.current.props.onCellEdit !== undefined &&
        live.current.effective[c]?.editable === true &&
        universe.leafAt(r) !== undefined,
      getCellText: (r, c) => {
        const col = live.current.effective[c];
        if (!col) return "";
        const group = universe.groupAt(r);
        if (group) {
          if (c === 0) return `${String(group.value)} (${group.count})`;
          const field = col.field ?? col.id;
          return group.aggregates[field] !== undefined ? String(group.aggregates[field]) : "";
        }
        const row = universe.leafAt(r);
        return row !== undefined ? String(col.accessor(row) ?? "") : "";
      },
    }),
  );

  // Visual column model: pinned first, then (re)ordered rest, with width
  // overrides and sticky offsets for the pinned prefix.
  const columnMeta = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    const order = effectiveColumnOrder(
      state.columns,
      columns.map((c) => c.id),
    );
    const pinnedSet = new Set(state.columns.pinnedLeft);
    let stickyOffset = 0;
    return order
      .map((id) => byId.get(id))
      .filter((c): c is GridColumn<T> => c !== undefined)
      .map((col) => {
        const width = state.columns.widths[col.id] ?? col.width;
        const pinned = pinnedSet.has(col.id);
        const pinnedWidth = width ?? 150;
        const meta = {
          col,
          pinned,
          width: pinned ? pinnedWidth : width,
          stickyLeft: pinned ? stickyOffset : null,
        };
        if (pinned) stickyOffset += pinnedWidth;
        return meta;
      });
  }, [columns, state.columns]);

  const effectiveColumns = useMemo(() => columnMeta.map((m) => m.col), [columnMeta]);
  live.current.effective = effectiveColumns;

  const fields = useMemo(() => columns.map((c) => c.field ?? c.id), [columns]);
  const accessorByField = useMemo(() => {
    const map = new Map(columns.map((c) => [c.field ?? c.id, c.accessor]));
    return (row: T, field: string) => map.get(field)?.(row);
  }, [columns]);

  const filtered = useMemo(
    () =>
      clientQuery ? filterRows(data, filterText, fields, { accessor: accessorByField }) : data,
    [clientQuery, data, filterText, fields, accessorByField],
  );
  const rows = useMemo(
    () =>
      clientQuery
        ? sortRows(filtered, state.sort, { accessor: accessorByField })
        : (filtered as T[]),
    [clientQuery, filtered, state.sort, accessorByField],
  );
  live.current.rows = rows;

  // Grouping: build the tree (sorted/filtered input) and flatten it against
  // the machine's collapsed-keys set. Null when ungrouped — zero overhead.
  const groupBy = props.groupBy;
  const grouped = clientQuery && (groupBy?.length ?? 0) > 0;
  const groupTree = useMemo(
    () =>
      grouped
        ? buildGroups(rows, groupBy!, {
            accessor: accessorByField,
            aggregates: columns
              .filter((c) => c.aggregate)
              .map((c) => ({ field: c.field ?? c.id, fn: c.aggregate! })),
          })
        : null,
    [grouped, rows, groupBy, accessorByField, columns],
  );
  const display = useMemo(
    () => (groupTree ? flattenGroups(groupTree, state.collapsedGroups) : null),
    [groupTree, state.collapsedGroups],
  );
  live.current.display = display;
  const rowCount = display?.length ?? rows.length;

  const onVisibleRowsChange = props.onVisibleRowsChange;
  useEffect(() => {
    onVisibleRowsChange?.(rows.length);
  }, [onVisibleRowsChange, rows.length]);

  const virtualizer = useVirtualizer({ count: rowCount, estimateSize: rowHeight });

  // Infinite scroll: notify once per "approach" as the window nears the end.
  const approachNotified = useRef(-1);
  useEffect(() => {
    const end = virtualizer.range.endIndex;
    if (rows.length === 0 || !live.current.props.onApproachEnd) return;
    if (end >= rows.length - approachThreshold && approachNotified.current !== rows.length) {
      approachNotified.current = rows.length;
      live.current.props.onApproachEnd();
    }
  }, [virtualizer.range.endIndex, rows.length, approachThreshold, live]);

  const commitCell = (rowIndex: number, colIndex: number, value: string) => {
    const { props: p } = live.current;
    const row = universe.leafAt(rowIndex);
    const col = live.current.effective[colIndex];
    if (row === undefined || !col?.editable) return;
    p.onCellEdit?.(p.getRowId(row), col.id, value, row);
  };

  useForgeEffects(store, {
    events: {
      selectionChange: (detail) =>
        live.current.props.onSelectionChange?.(
          (detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys,
        ),
      sortChange: (detail) =>
        live.current.props.onSortChange?.((detail as { sort: readonly SortSpec[] }).sort),
      cellCommit: (detail) => {
        const { row, col, value } = detail as { row: number; col: number; value: string };
        commitCell(row, col, value);
      },
      cellsPaste: (detail) => {
        const { row, col, values } = detail as { row: number; col: number; values: string[][] };
        values.forEach((line, dr) =>
          line.forEach((value, dc) => commitCell(row + dr, col + dc, value)),
        );
        announceNow(`Pasted ${values.length} row${values.length > 1 ? "s" : ""}`);
      },
    },
    overrides: {
      [scrollToItem.type]: (effect) => {
        const index = Number((effect.payload as { key: string }).key);
        if (Number.isFinite(index)) virtualizer.scrollToIndex(index);
      },
      [clipboardCopy.type]: (effect) => {
        const { text, rows: count } = effect.payload as { text: string; rows: number };
        void navigator.clipboard?.writeText(text);
        announceNow(`Copied ${count} row${count > 1 ? "s" : ""} to clipboard`);
      },
    },
  });

  const onKeyDown = useKeymap(() => GRID_KEYMAP, dispatch);

  const [onCellPointerDown] = useState(() => (row: number, col: number, e: React.PointerEvent) => {
    dispatch(gridIntents.moveTo({ row, col }, "pointer"));
    dispatch(
      gridIntents.selectRow({ row, toggle: e.ctrlKey || e.metaKey, extend: e.shiftKey }, "pointer"),
    );
  });

  const [onGroupPointerDown] = useState(() => (row: number, key: string) => {
    dispatch(gridIntents.moveTo({ row, col: 0 }, "pointer"));
    dispatch(gridIntents.toggleGroup({ key }, "pointer"));
  });

  const [editorHandlers] = useState(() => ({
    onCellDoubleClick: (row: number, col: number) => {
      dispatch(gridIntents.moveTo({ row, col }, "pointer"));
      dispatch(gridIntents.editStart({}, "pointer"));
    },
    onEditorChange: (value: string) => dispatch(gridIntents.editChange({ value }, "keyboard")),
    onEditorKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation(); // the host keymap must not see editor keystrokes
      if (e.key === "Enter") {
        e.preventDefault();
        dispatch(gridIntents.editCommit({ direction: "down" }, "keyboard"));
      } else if (e.key === "Tab") {
        e.preventDefault();
        dispatch(gridIntents.editCommit({ direction: "right" }, "keyboard"));
      } else if (e.key === "Escape") {
        e.preventDefault();
        dispatch(gridIntents.editCancel(undefined, "keyboard"));
      }
    },
  }));

  // Return DOM focus to the grid when editing ends, so navigation resumes.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && state.editing === null) hostRef.current?.focus();
    wasEditing.current = state.editing !== null;
  }, [state.editing]);

  const onPaste = (e: React.ClipboardEvent) => {
    if (state.editing || !props.onCellEdit) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const values = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line, i, all) => line.length > 0 || i < all.length - 1)
      .map((line) => line.split("\t"));
    if (values.length > 0) dispatch(gridIntents.paste({ values }, "program"));
  };

  // Column ops: resize by pointer drag, reorder by HTML5 drag & drop, pin.
  const [columnOps] = useState(() => ({
    onResizeStart: (columnId: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget as HTMLElement;
      const headerCell = handle.parentElement as HTMLElement;
      const startX = e.clientX;
      const startWidth = headerCell.getBoundingClientRect().width;
      handle.setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        dispatch(
          gridIntents.resizeColumn(
            { columnId, width: startWidth + (ev.clientX - startX) },
            "pointer",
          ),
        );
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
    },
    onDropColumn: (draggedId: string, targetId: string) => {
      // The machine expects an index within the unpinned region.
      const pinned = new Set(store.getState().columns.pinnedLeft);
      const unpinnedIds = live.current.effective.map((c) => c.id).filter((id) => !pinned.has(id));
      const toIndex = unpinnedIds.indexOf(targetId);
      if (toIndex >= 0) {
        dispatch(gridIntents.moveColumn({ columnId: draggedId, toIndex }, "pointer"));
      }
    },
    onTogglePin: (columnId: string, pinned: boolean) =>
      dispatch(gridIntents.pinColumn({ columnId, pinned }, "pointer")),
    onToggleSort: (field: string, additive: boolean) =>
      dispatch(gridIntents.toggleSort({ field, additive }, "pointer")),
  }));

  const cursor = state.cursor;
  const activeCellId = cursor !== null ? `${baseId}-r${cursor.row}-c${cursor.col}` : undefined;
  const gridTemplateColumns = columnMeta
    .map((m) => (m.width ? `${m.width}px` : "minmax(140px, 1fr)"))
    .join(" ");
  const minRowWidth = columnMeta.reduce((sum, m) => sum + (m.width ?? 140), 0);

  return (
    <div
      role="grid"
      aria-label={props["aria-label"]}
      aria-rowcount={rowCount + 1}
      aria-colcount={columnMeta.length}
      aria-activedescendant={activeCellId}
      aria-multiselectable={selectionMode === "multiple" || undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      ref={(el) => {
        hostRef.current = el;
        virtualizer.scrollElementRef(el);
      }}
      style={{ height }}
      className={cn(
        "overflow-auto rounded-lg border border-border bg-surface text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div
        role="row"
        aria-rowindex={1}
        className="sticky top-0 z-10 grid border-b border-border bg-muted/80 backdrop-blur"
        style={{ gridTemplateColumns, minWidth: minRowWidth }}
      >
        {columnMeta.map((meta, colIndex) => (
          <HeaderCell
            key={meta.col.id}
            column={meta.col}
            colIndex={colIndex}
            pinned={meta.pinned}
            stickyLeft={meta.stickyLeft}
            sort={state.sort}
            ops={columnOps}
          />
        ))}
      </div>

      <div style={{ height: virtualizer.range.totalSize, position: "relative" }}>
        {virtualizer.range.items.map((item) => {
          const itemStyle: CSSProperties = {
            position: "absolute",
            top: 0,
            transform: `translateY(${item.start}px)`,
            height: item.size,
            left: 0,
            width: "100%",
            minWidth: minRowWidth,
          };
          const entry = display?.[item.index];
          if (entry?.kind === "group") {
            return (
              <GroupRowView
                key={entry.group.key}
                rowIndex={item.index}
                group={entry.group}
                collapsed={state.collapsedGroups.has(entry.group.key)}
                cursorOn={cursor?.row === item.index}
                columnMeta={columnMeta}
                gridTemplateColumns={gridTemplateColumns}
                onGroupPointerDown={onGroupPointerDown}
                style={itemStyle}
              />
            );
          }
          const row = entry ? entry.row : rows[item.index];
          const rowKey = getRowId(row);
          return (
            <GridRow
              key={rowKey}
              baseId={baseId}
              row={row}
              rowIndex={item.index}
              columnMeta={columnMeta}
              gridTemplateColumns={gridTemplateColumns}
              minRowWidth={minRowWidth}
              selected={state.selectedRows.has(rowKey)}
              cursorCol={cursor?.row === item.index ? cursor.col : null}
              editingCol={state.editing?.row === item.index ? state.editing.col : null}
              draft={state.editing?.row === item.index ? state.editing.draft : ""}
              editorHandlers={editorHandlers}
              onCellPointerDown={onCellPointerDown}
              style={itemStyle}
            />
          );
        })}
        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-muted-foreground">No rows match.</div>
        )}
      </div>
    </div>
  );
}

interface ColumnOps {
  onResizeStart: (columnId: string, e: React.PointerEvent) => void;
  onDropColumn: (draggedId: string, targetId: string) => void;
  onTogglePin: (columnId: string, pinned: boolean) => void;
  onToggleSort: (field: string, additive: boolean) => void;
}

interface HeaderCellProps<T> {
  column: GridColumn<T>;
  colIndex: number;
  pinned: boolean;
  stickyLeft: number | null;
  sort: GridState["sort"];
  ops: ColumnOps;
}

const HeaderCell = memo(function HeaderCell<T>({
  column,
  colIndex,
  pinned,
  stickyLeft,
  sort,
  ops,
}: HeaderCellProps<T>) {
  const field = column.field ?? column.id;
  const index = sort.findIndex((s: SortSpec) => s.field === field);
  const spec = index >= 0 ? sort[index] : undefined;
  const movable = !column.fixed && !pinned;
  return (
    <div
      role="columnheader"
      aria-colindex={colIndex + 1}
      aria-sort={spec ? (spec.direction === "asc" ? "ascending" : "descending") : undefined}
      draggable={movable}
      onDragStart={movable ? (e) => e.dataTransfer.setData("text/column-id", column.id) : undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text/column-id");
        if (draggedId && draggedId !== column.id) ops.onDropColumn(draggedId, column.id);
      }}
      style={stickyLeft !== null ? { position: "sticky", left: stickyLeft, zIndex: 11 } : undefined}
      className={cn(
        "group/header relative flex items-center gap-1 px-3 py-2.5 font-medium text-muted-foreground",
        column.align === "right" && "justify-end text-right",
        column.align === "center" && "justify-center",
        movable && "cursor-grab",
        pinned && "bg-muted",
      )}
    >
      {column.sortable ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => ops.onToggleSort(field, e.shiftKey)}
          title="Click to sort - Shift+Click for multi-sort"
          className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <span className="truncate">{column.header}</span>
          {!spec && <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />}
          {spec?.direction === "asc" && <ArrowUp className="size-3.5 shrink-0" />}
          {spec?.direction === "desc" && <ArrowDown className="size-3.5 shrink-0" />}
          {spec && sort.length > 1 && (
            <span className="rounded bg-accent px-1 text-[10px] tabular-nums">{index + 1}</span>
          )}
        </button>
      ) : (
        <span className="truncate">{column.header}</span>
      )}
      {!column.fixed && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={pinned ? `Unpin ${column.header}` : `Pin ${column.header}`}
          title={pinned ? "Unpin column" : "Pin column"}
          onClick={() => ops.onTogglePin(column.id, !pinned)}
          className={cn(
            "ml-auto shrink-0 rounded p-0.5 transition-opacity hover:bg-accent hover:text-foreground",
            pinned ? "opacity-100" : "opacity-0 group-hover/header:opacity-100",
          )}
        >
          {pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
        </button>
      )}
      {!column.fixed && (
        <span
          role="presentation"
          onPointerDown={(e) => ops.onResizeStart(column.id, e)}
          draggable={false}
          className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none select-none hover:bg-ring/40"
        />
      )}
    </div>
  );
}) as <T>(props: HeaderCellProps<T>) => ReactNode;

const aggregateFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const AGGREGATE_PREFIX: Record<AggregateFn, string> = {
  sum: "Σ",
  avg: "⌀",
  min: "min",
  max: "max",
  count: "#",
};

interface GroupRowViewProps<T> {
  rowIndex: number;
  group: GroupNode<T>;
  collapsed: boolean;
  cursorOn: boolean;
  columnMeta: ColumnMeta<T>[];
  gridTemplateColumns: string;
  onGroupPointerDown: (rowIndex: number, key: string) => void;
  style: CSSProperties;
}

/** Group header row: chevron + value + count, aggregates in their columns. */
const GroupRowView = memo(function GroupRowView<T>({
  rowIndex,
  group,
  collapsed,
  cursorOn,
  columnMeta,
  gridTemplateColumns,
  onGroupPointerDown,
  style,
}: GroupRowViewProps<T>) {
  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-expanded={!collapsed}
      onPointerDown={() => onGroupPointerDown(rowIndex, group.key)}
      style={{ ...style, gridTemplateColumns }}
      className={cn(
        "grid cursor-default border-b border-border bg-muted/60 font-medium transition-colors hover:bg-muted",
        cursorOn && "ring-2 ring-ring ring-inset",
      )}
    >
      {columnMeta.map(({ col, stickyLeft }, colIndex) => {
        const field = col.field ?? col.id;
        const aggregate = col.aggregate ? group.aggregates[field] : undefined;
        return (
          <div
            key={col.id}
            role="gridcell"
            aria-colindex={colIndex + 1}
            style={
              stickyLeft !== null ? { position: "sticky", left: stickyLeft, zIndex: 5 } : undefined
            }
            className={cn(
              "flex items-center gap-1.5 truncate px-3",
              col.align === "right" && "justify-end text-right tabular-nums",
              stickyLeft !== null && "bg-muted",
            )}
          >
            {colIndex === 0 ? (
              <span
                className="flex min-w-0 items-center gap-1.5"
                style={{ paddingInlineStart: `${group.depth * 16}px` }}
              >
                <ChevronRight
                  className={cn("size-4 shrink-0 transition-transform", !collapsed && "rotate-90")}
                />
                <span className="truncate">{String(group.value)}</span>
                <span className="shrink-0 font-normal text-muted-foreground">({group.count})</span>
              </span>
            ) : aggregate !== undefined ? (
              <span className="truncate text-xs text-muted-foreground">
                {AGGREGATE_PREFIX[col.aggregate!]} {aggregateFormat.format(aggregate)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}) as <T>(props: GroupRowViewProps<T>) => ReactNode;

interface GridEditorHandlers {
  onCellDoubleClick: (row: number, col: number) => void;
  onEditorChange: (value: string) => void;
  onEditorKeyDown: (e: React.KeyboardEvent) => void;
}

interface ColumnMeta<T> {
  col: GridColumn<T>;
  pinned: boolean;
  width: number | undefined;
  stickyLeft: number | null;
}

interface GridRowProps<T> {
  baseId: string;
  row: T;
  rowIndex: number;
  columnMeta: ColumnMeta<T>[];
  gridTemplateColumns: string;
  minRowWidth: number;
  selected: boolean;
  /** Column index of the cursor when it sits on this row, else null. */
  cursorCol: number | null;
  /** Column being edited on this row (with its live draft), else null. */
  editingCol: number | null;
  draft: string;
  editorHandlers: GridEditorHandlers;
  onCellPointerDown: (row: number, col: number, e: React.PointerEvent) => void;
  style: CSSProperties;
}

/** Rows are memoized: scrolling and cursor moves re-render ~2 rows, not all. */
const GridRow = memo(function GridRow<T>({
  baseId,
  row,
  rowIndex,
  columnMeta,
  gridTemplateColumns,
  selected,
  cursorCol,
  editingCol,
  draft,
  editorHandlers,
  onCellPointerDown,
  style,
}: GridRowProps<T>) {
  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-selected={selected || undefined}
      style={{ ...style, gridTemplateColumns }}
      className={cn(
        "grid border-b border-border transition-colors",
        selected ? "bg-accent/40" : "hover:bg-muted/50",
      )}
    >
      {columnMeta.map(({ col, stickyLeft }, colIndex) => (
        <div
          key={col.id}
          id={`${baseId}-r${rowIndex}-c${colIndex}`}
          role="gridcell"
          aria-colindex={colIndex + 1}
          data-cursor={cursorCol === colIndex || undefined}
          onPointerDown={(e) => onCellPointerDown(rowIndex, colIndex, e)}
          onDoubleClick={
            col.editable ? () => editorHandlers.onCellDoubleClick(rowIndex, colIndex) : undefined
          }
          style={
            stickyLeft !== null ? { position: "sticky", left: stickyLeft, zIndex: 5 } : undefined
          }
          className={cn(
            "flex items-center truncate px-3",
            col.align === "right" && "justify-end text-right tabular-nums",
            col.align === "center" && "justify-center",
            cursorCol === colIndex && "ring-2 ring-ring ring-inset",
            stickyLeft !== null && (selected ? "bg-accent" : "bg-surface"),
          )}
        >
          {editingCol === colIndex ? (
            <input
              autoFocus
              value={draft}
              aria-label={`Edit ${col.header}`}
              onFocus={(e) => e.target.select()}
              onChange={(e) => editorHandlers.onEditorChange(e.target.value)}
              onKeyDown={editorHandlers.onEditorKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full rounded-sm bg-surface px-1 py-0.5 text-sm ring-2 ring-primary outline-none"
            />
          ) : col.cell ? (
            col.cell(row)
          ) : (
            String(col.accessor(row) ?? "")
          )}
        </div>
      ))}
    </div>
  );
}) as <T>(props: GridRowProps<T>) => ReactNode;
