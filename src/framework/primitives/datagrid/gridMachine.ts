import {
  createMachine,
  defineEffect,
  defineIntent,
  emitEvent,
  scrollToItem,
  toTransition,
  withEffects,
  type Key,
  type Machine,
  type TransitionResult,
} from "@/framework/core";
import { toggleSort, type SortSpec } from "@/framework/core/data/query";

/**
 * Grid machine — spreadsheet-style 2D cursor, row selection with ranges,
 * multi-column sort, inline cell editing and clipboard semantics. Pure:
 * row/column geometry and cell text are injected through config getters, so
 * the machine is oblivious to sorting, filtering and virtualization happening
 * around it. Fully unit-testable without DOM.
 */

export interface GridCursor {
  readonly row: number;
  readonly col: number;
}

export interface GridEditing {
  readonly row: number;
  readonly col: number;
  /** Live draft — journaled like everything else. */
  readonly draft: string;
}

export interface GridColumnsState {
  /** Visual order of unpinned columns (null = natural prop order). */
  readonly order: readonly string[] | null;
  /** Width overrides in px, by column id. */
  readonly widths: Readonly<Record<string, number>>;
  /** Columns pinned to the start, in pin order. */
  readonly pinnedLeft: readonly string[];
}

export interface GridState {
  readonly cursor: GridCursor | null;
  readonly selectedRows: ReadonlySet<Key>;
  readonly anchorRow: number | null;
  readonly sort: readonly SortSpec[];
  readonly editing: GridEditing | null;
  readonly columns: GridColumnsState;
  /** Collapsed group keys (groups are expanded by default). */
  readonly collapsedGroups: ReadonlySet<string>;
}

/** Resolve the visual column order: pinned first, then the (re)ordered rest. */
export function effectiveColumnOrder(
  columns: GridColumnsState,
  allIds: readonly string[],
): string[] {
  const pinned = columns.pinnedLeft.filter((id) => allIds.includes(id));
  const base = columns.order ?? allIds;
  const rest = base.filter((id) => allIds.includes(id) && !pinned.includes(id));
  // Ids added to props after a reorder still show up (appended at the end).
  for (const id of allIds) if (!pinned.includes(id) && !rest.includes(id)) rest.push(id);
  return [...pinned, ...rest];
}

export const MIN_COLUMN_WIDTH = 60;

export interface GridConfig {
  rowCount(): number;
  colCount(): number;
  getRowKey(rowIndex: number): Key;
  /** All column ids in natural (prop) order. */
  getColumnIds?(): readonly string[];
  /** Sortable field for a column, or null when the column isn't sortable. */
  getSortField(colIndex: number): string | null;
  selectionMode?: "none" | "single" | "multiple";
  /** Editing/clipboard hooks; omit for read-only grids. */
  isCellEditable?(rowIndex: number, colIndex: number): boolean;
  getCellText?(rowIndex: number, colIndex: number): string;
  /** Grouping: true when the display row at this index is a group header. */
  isGroupRow?(rowIndex: number): boolean;
}

export const gridIntents = {
  move: defineIntent<{ dRow: number; dCol: number; extend?: boolean }>("grid/move"),
  moveTo: defineIntent<{ row: number; col: number }>("grid/move-to"),
  rowStart: defineIntent<void>("grid/row-start"),
  rowEnd: defineIntent<void>("grid/row-end"),
  firstCell: defineIntent<void>("grid/first-cell"),
  lastCell: defineIntent<void>("grid/last-cell"),
  page: defineIntent<{ direction: 1 | -1; size?: number }>("grid/page"),
  selectRow: defineIntent<{ row?: number; toggle?: boolean; extend?: boolean }>("grid/select-row"),
  selectAll: defineIntent<void>("grid/select-all"),
  clearSelection: defineIntent<void>("grid/clear-selection"),
  toggleSort: defineIntent<{ field: string; additive?: boolean }>("grid/toggle-sort"),
  /** Start editing the cursor cell; `initial` seeds the draft (type-to-edit). */
  editStart: defineIntent<{ initial?: string } | void>("grid/edit-start"),
  editChange: defineIntent<{ value: string }>("grid/edit-change"),
  /** Commit the draft and move like a spreadsheet (Enter ↓, Tab →). */
  editCommit: defineIntent<{ direction?: "down" | "right" | "none" } | void>("grid/edit-commit"),
  editCancel: defineIntent<void>("grid/edit-cancel"),
  copy: defineIntent<void>("grid/copy"),
  /** Parsed clipboard grid (rows × columns of text), pasted at the cursor. */
  paste: defineIntent<{ values: string[][] }>("grid/paste"),
  /** Collapse/expand a group row (key defaults to the cursor row's key). */
  toggleGroup: defineIntent<{ key?: string } | void>("grid/toggle-group"),
  resizeColumn: defineIntent<{ columnId: string; width: number }>("grid/resize-column"),
  /** Move a column to a visual index within the unpinned region. */
  moveColumn: defineIntent<{ columnId: string; toIndex: number }>("grid/move-column"),
  pinColumn: defineIntent<{ columnId: string; pinned: boolean }>("grid/pin-column"),
};

/** Executed by the adapter: write text to the system clipboard. */
export const clipboardCopy = defineEffect<{ text: string; rows: number }>("clipboard/copy");

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export function createGridMachine(config: GridConfig): Machine<GridState> {
  const initialState: GridState = {
    cursor: null,
    selectedRows: new Set(),
    anchorRow: null,
    sort: [],
    editing: null,
    columns: { order: null, widths: {}, pinnedLeft: [] },
    collapsedGroups: new Set(),
  };

  const moveCursor = (
    state: GridState,
    row: number,
    col: number,
    extend = false,
  ): TransitionResult<GridState> => {
    const rows = config.rowCount();
    const cols = config.colCount();
    if (rows === 0 || cols === 0) return state;
    const next: GridCursor = { row: clamp(row, rows - 1), col: clamp(col, cols - 1) };
    if (state.cursor && next.row === state.cursor.row && next.col === state.cursor.col) {
      return state;
    }
    let result: GridState = { ...state, cursor: next };
    const effects = [
      scrollToItem({ key: String(next.row) }),
      emitEvent({ name: "cursorChange", detail: { cursor: next } }),
    ];
    if (extend && config.selectionMode === "multiple") {
      const anchor = state.anchorRow ?? state.cursor?.row ?? next.row;
      const [from, to] = anchor <= next.row ? [anchor, next.row] : [next.row, anchor];
      const selected = new Set<Key>();
      for (let i = from; i <= to; i++) {
        if (!config.isGroupRow?.(i)) selected.add(config.getRowKey(i));
      }
      result = { ...result, selectedRows: selected, anchorRow: anchor };
      effects.push(emitEvent({ name: "selectionChange", detail: { selectedKeys: selected } }));
    }
    return withEffects(result, ...effects);
  };

  const selectRow = (
    state: GridState,
    row: number,
    toggle: boolean,
    extend: boolean,
  ): TransitionResult<GridState> => {
    const mode = config.selectionMode ?? "multiple";
    if (mode === "none" || row < 0 || row >= config.rowCount()) return state;
    if (config.isGroupRow?.(row)) return state; // group headers are not selectable
    const key = config.getRowKey(row);
    let selected: Set<Key>;
    let anchorRow = row;
    if (mode === "single") {
      selected = new Set(state.selectedRows.has(key) && toggle ? [] : [key]);
    } else if (extend && state.anchorRow !== null) {
      anchorRow = state.anchorRow;
      const [from, to] = anchorRow <= row ? [anchorRow, row] : [row, anchorRow];
      selected = toggle ? new Set(state.selectedRows) : new Set<Key>();
      for (let i = from; i <= to; i++) selected.add(config.getRowKey(i));
    } else if (toggle) {
      selected = new Set(state.selectedRows);
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
    } else {
      selected = new Set([key]);
    }
    return withEffects(
      { ...state, selectedRows: selected, anchorRow },
      emitEvent({ name: "selectionChange", detail: { selectedKeys: selected } }),
    );
  };

  /** Editing is modal at machine level: navigation waits for commit/cancel. */
  const unlessEditing =
    (handler: (state: GridState, intent: { payload?: unknown }) => TransitionResult<GridState>) =>
    (state: GridState, intent: { payload?: unknown }): TransitionResult<GridState> =>
      state.editing ? state : handler(state, intent);

  const toggleGroupKey = (state: GridState, key: string): TransitionResult<GridState> => {
    const collapsed = new Set(state.collapsedGroups);
    if (collapsed.has(key)) collapsed.delete(key);
    else collapsed.add(key);
    return withEffects(
      { ...state, collapsedGroups: collapsed },
      emitEvent({ name: "groupsChange", detail: { collapsedGroups: collapsed } }),
    );
  };

  const startEditing = (state: GridState, initial?: string): TransitionResult<GridState> => {
    if (!state.cursor || !config.isCellEditable) return state;
    const { row, col } = state.cursor;
    if (!config.isCellEditable(row, col)) return state;
    const draft = initial ?? config.getCellText?.(row, col) ?? "";
    return { ...state, editing: { row, col, draft } };
  };

  return createMachine<GridState>({
    id: "datagrid",
    initialState,
    handlers: {
      [gridIntents.editStart.type]: (state, intent) => {
        if (state.editing) return state;
        // Enter on a group header toggles it instead of editing.
        if (state.cursor && config.isGroupRow?.(state.cursor.row)) {
          return toggleGroupKey(state, config.getRowKey(state.cursor.row) as string);
        }
        const { initial } = (intent.payload ?? {}) as { initial?: string };
        return startEditing(state, initial);
      },

      [gridIntents.toggleGroup.type]: (state, intent) => {
        const payload = (intent.payload ?? {}) as { key?: string };
        const key =
          payload.key ??
          (state.cursor && config.isGroupRow?.(state.cursor.row)
            ? (config.getRowKey(state.cursor.row) as string)
            : undefined);
        if (key === undefined) return state;
        return toggleGroupKey(state, key);
      },
      [gridIntents.editChange.type]: (state, intent) => {
        if (!state.editing) return state;
        const { value } = intent.payload as { value: string };
        return { ...state, editing: { ...state.editing, draft: value } };
      },
      [gridIntents.editCancel.type]: (state) =>
        state.editing ? { ...state, editing: null } : state,
      [gridIntents.editCommit.type]: (state, intent) => {
        if (!state.editing) return state;
        const { direction = "down" } = (intent.payload ?? {}) as {
          direction?: "down" | "right" | "none";
        };
        const { row, col, draft } = state.editing;
        const committed: GridState = { ...state, editing: null };
        const commit = emitEvent({
          name: "cellCommit",
          detail: { row, col, rowKey: config.getRowKey(row), value: draft },
        });
        if (direction === "none") return withEffects(committed, commit);
        const moved = toTransition(
          moveCursor(
            committed,
            row + (direction === "down" ? 1 : 0),
            col + (direction === "right" ? 1 : 0),
          ),
        );
        return withEffects(moved.state, commit, ...moved.effects);
      },

      [gridIntents.copy.type]: (state) => {
        if (!config.getCellText) return state;
        const cols = config.colCount();
        // Selected rows when any, else the cursor cell.
        let rowIndices: number[];
        let colIndices: number[];
        if (state.selectedRows.size > 0) {
          rowIndices = [];
          for (let i = 0; i < config.rowCount(); i++) {
            if (state.selectedRows.has(config.getRowKey(i))) rowIndices.push(i);
          }
          colIndices = Array.from({ length: cols }, (_, i) => i);
        } else if (state.cursor) {
          rowIndices = [state.cursor.row];
          colIndices = [state.cursor.col];
        } else {
          return state;
        }
        const text = rowIndices
          .map((r) => colIndices.map((c) => config.getCellText!(r, c)).join("\t"))
          .join("\n");
        return withEffects(state, clipboardCopy({ text, rows: rowIndices.length }));
      },

      [gridIntents.paste.type]: (state, intent) => {
        if (!state.cursor || !config.isCellEditable) return state;
        const { values } = intent.payload as { values: string[][] };
        if (values.length === 0) return state;
        // The component fans this out to per-cell commits (bounds + editability
        // are re-checked there against the live row universe).
        return withEffects(
          state,
          emitEvent({
            name: "cellsPaste",
            detail: { row: state.cursor.row, col: state.cursor.col, values },
          }),
        );
      },

      [gridIntents.resizeColumn.type]: (state, intent) => {
        const { columnId, width } = intent.payload as { columnId: string; width: number };
        const clamped = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
        if (state.columns.widths[columnId] === clamped) return state;
        const columns: GridColumnsState = {
          ...state.columns,
          widths: { ...state.columns.widths, [columnId]: clamped },
        };
        return withEffects(
          { ...state, columns },
          emitEvent({ name: "columnsChange", detail: { columns } }),
        );
      },

      [gridIntents.moveColumn.type]: (state, intent) => {
        const { columnId, toIndex } = intent.payload as { columnId: string; toIndex: number };
        const allIds = config.getColumnIds?.() ?? [];
        if (state.columns.pinnedLeft.includes(columnId)) return state;
        const unpinned = (state.columns.order ?? allIds).filter(
          (id) => !state.columns.pinnedLeft.includes(id),
        );
        const from = unpinned.indexOf(columnId);
        if (from === -1) return state;
        const target = Math.max(0, Math.min(unpinned.length - 1, toIndex));
        if (target === from) return state;
        const order = [...unpinned];
        order.splice(from, 1);
        order.splice(target, 0, columnId);
        const columns: GridColumnsState = { ...state.columns, order };
        return withEffects(
          { ...state, columns },
          emitEvent({ name: "columnsChange", detail: { columns } }),
        );
      },

      [gridIntents.pinColumn.type]: (state, intent) => {
        const { columnId, pinned } = intent.payload as { columnId: string; pinned: boolean };
        const already = state.columns.pinnedLeft.includes(columnId);
        if (pinned === already) return state;
        const pinnedLeft = pinned
          ? [...state.columns.pinnedLeft, columnId]
          : state.columns.pinnedLeft.filter((id) => id !== columnId);
        const columns: GridColumnsState = { ...state.columns, pinnedLeft };
        return withEffects(
          { ...state, columns },
          emitEvent({ name: "columnsChange", detail: { columns } }),
        );
      },

      [gridIntents.move.type]: unlessEditing((state, intent) => {
        const { dRow, dCol, extend } = intent.payload as {
          dRow: number;
          dCol: number;
          extend?: boolean;
        };
        const cursor = state.cursor ?? { row: 0, col: 0 };
        const target = state.cursor ? { row: cursor.row + dRow, col: cursor.col + dCol } : cursor;
        return moveCursor(state, target.row, target.col, extend);
      }),
      [gridIntents.moveTo.type]: unlessEditing((state, intent) => {
        const { row, col } = intent.payload as { row: number; col: number };
        return moveCursor(state, row, col);
      }),
      [gridIntents.rowStart.type]: unlessEditing((state) =>
        state.cursor ? moveCursor(state, state.cursor.row, 0) : state,
      ),
      [gridIntents.rowEnd.type]: unlessEditing((state) =>
        state.cursor ? moveCursor(state, state.cursor.row, config.colCount() - 1) : state,
      ),
      [gridIntents.firstCell.type]: unlessEditing((state) => moveCursor(state, 0, 0)),
      [gridIntents.lastCell.type]: unlessEditing((state) =>
        moveCursor(state, config.rowCount() - 1, config.colCount() - 1),
      ),
      [gridIntents.page.type]: unlessEditing((state, intent) => {
        const { direction, size } = intent.payload as { direction: 1 | -1; size?: number };
        const cursor = state.cursor ?? { row: 0, col: 0 };
        return moveCursor(state, cursor.row + direction * (size ?? 20), cursor.col);
      }),
      [gridIntents.selectRow.type]: unlessEditing((state, intent) => {
        const payload = (intent.payload ?? {}) as {
          row?: number;
          toggle?: boolean;
          extend?: boolean;
        };
        const row = payload.row ?? state.cursor?.row;
        if (row === undefined) return state;
        return selectRow(state, row, payload.toggle ?? false, payload.extend ?? false);
      }),
      [gridIntents.selectAll.type]: unlessEditing((state) => {
        if (config.selectionMode !== "multiple") return state;
        const selected = new Set<Key>();
        for (let i = 0; i < config.rowCount(); i++) {
          if (!config.isGroupRow?.(i)) selected.add(config.getRowKey(i));
        }
        return withEffects(
          { ...state, selectedRows: selected },
          emitEvent({ name: "selectionChange", detail: { selectedKeys: selected } }),
        );
      }),
      [gridIntents.clearSelection.type]: unlessEditing((state) => {
        if (state.selectedRows.size === 0) return state;
        const selected = new Set<Key>();
        return withEffects(
          { ...state, selectedRows: selected },
          emitEvent({ name: "selectionChange", detail: { selectedKeys: selected } }),
        );
      }),
      [gridIntents.toggleSort.type]: unlessEditing((state, intent) => {
        const { field, additive } = intent.payload as { field: string; additive?: boolean };
        const sort = toggleSort(state.sort, field, additive ?? false);
        return withEffects({ ...state, sort }, emitEvent({ name: "sortChange", detail: { sort } }));
      }),
    },
  });
}

export const GRID_KEYMAP = [
  { keys: "ArrowDown", intent: () => gridIntents.move({ dRow: 1, dCol: 0 }, "keyboard") },
  { keys: "ArrowUp", intent: () => gridIntents.move({ dRow: -1, dCol: 0 }, "keyboard") },
  { keys: "ArrowRight", intent: () => gridIntents.move({ dRow: 0, dCol: 1 }, "keyboard") },
  { keys: "ArrowLeft", intent: () => gridIntents.move({ dRow: 0, dCol: -1 }, "keyboard") },
  {
    keys: "Shift+ArrowDown",
    intent: () => gridIntents.move({ dRow: 1, dCol: 0, extend: true }, "keyboard"),
  },
  {
    keys: "Shift+ArrowUp",
    intent: () => gridIntents.move({ dRow: -1, dCol: 0, extend: true }, "keyboard"),
  },
  { keys: "Home", intent: () => gridIntents.rowStart(undefined, "keyboard") },
  { keys: "End", intent: () => gridIntents.rowEnd(undefined, "keyboard") },
  { keys: "Mod+Home", intent: () => gridIntents.firstCell(undefined, "keyboard") },
  { keys: "Mod+End", intent: () => gridIntents.lastCell(undefined, "keyboard") },
  { keys: "PageDown", intent: () => gridIntents.page({ direction: 1 }, "keyboard") },
  { keys: "PageUp", intent: () => gridIntents.page({ direction: -1 }, "keyboard") },
  { keys: "Space", intent: () => gridIntents.selectRow({ toggle: true }, "keyboard") },
  { keys: "Shift+Space", intent: () => gridIntents.selectRow({ extend: true }, "keyboard") },
  { keys: "Mod+a", intent: () => gridIntents.selectAll(undefined, "keyboard") },
  { keys: "Escape", intent: () => gridIntents.clearSelection(undefined, "keyboard") },
  { keys: "Mod+c", intent: () => gridIntents.copy(undefined, "keyboard") },
  { keys: "F2", intent: () => gridIntents.editStart({}, "keyboard") },
  { keys: "Enter", intent: () => gridIntents.editStart({}, "keyboard") },
  // Type-to-edit: any printable character replaces the cell content.
  // Space stays bound to row selection above; modifiers never reach here.
  {
    keys: "@printable",
    intent: (stroke: { key: string }) =>
      stroke.key === " " ? null : gridIntents.editStart({ initial: stroke.key }, "keyboard"),
  },
];
