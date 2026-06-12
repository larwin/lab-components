import {
  createStore,
  createVirtualizer,
  resolveBinding,
  scrollToItem,
  sortRows,
  type KeyStroke,
  type Store,
  type Virtualizer,
} from "@/framework/core";
import {
  GRID_KEYMAP,
  createGridMachine,
  gridIntents,
  type GridState,
} from "@/framework/primitives/datagrid/gridMachine";

/**
 * Canvas grid renderer — the second adapter.
 *
 * THIS FILE IMPORTS NO REACT. The same pure grid machine, the same Fenwick
 * virtualizer, the same declarative keymap and the same sort core that drive
 * the React DataGrid here drive an immediate-mode canvas painter. React's
 * only role on the demo page is mounting one <div>; every row, cell, header,
 * selection highlight and cursor ring below is painted imperatively at
 * scroll speed. This is what "React is an adapter" means in practice —
 * a Vue/Solid/WebGL adapter would swap exactly this layer.
 */

export interface CanvasColumn<T> {
  id: string;
  header: string;
  width: number;
  align?: "left" | "right";
  sortable?: boolean;
  getText(row: T): string;
}

export interface CanvasGridOptions<T> {
  container: HTMLElement;
  columns: CanvasColumn<T>[];
  getRows(): readonly T[];
  getRowKey(row: T): string;
  rowHeight?: number;
  headerHeight?: number;
  /** Paint statistics callback (for benchmark displays). */
  onPaint?(stats: { ms: number; rowsPainted: number; totalRows: number }): void;
  onSelectionChange?(count: number): void;
}

export interface CanvasGridHandle {
  store: Store<GridState>;
  /** Re-read rows (after external data changes) and repaint. */
  refresh(): void;
  destroy(): void;
}

interface Theme {
  background: string;
  headerBackground: string;
  border: string;
  text: string;
  mutedText: string;
  selectedBackground: string;
  cursor: string;
  zebra: string;
}

const readTheme = (el: HTMLElement): Theme => {
  const style = getComputedStyle(el);
  const variable = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    background: variable("--color-surface", "#ffffff"),
    headerBackground: variable("--color-muted", "#f4f4f5"),
    border: variable("--color-border", "#e4e4e7"),
    text: variable("--color-foreground", "#18181b"),
    mutedText: variable("--color-muted-foreground", "#71717a"),
    selectedBackground: variable("--color-accent", "#e0e7ff"),
    cursor: variable("--color-ring", "#6366f1"),
    zebra: variable("--color-muted", "#f4f4f5"),
  };
};

const strokeFromKeyboardEvent = (e: KeyboardEvent): KeyStroke => ({
  key: e.key,
  ctrl: e.ctrlKey,
  meta: e.metaKey,
  alt: e.altKey,
  shift: e.shiftKey,
  at: e.timeStamp,
});

export function mountCanvasGrid<T>(options: CanvasGridOptions<T>): CanvasGridHandle {
  const { container, columns, getRows, getRowKey, onPaint } = options;
  const rowHeight = options.rowHeight ?? 36;
  const headerHeight = options.headerHeight ?? 40;
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);

  /* ---- machine: identical to the React grid ---- */
  let sortedRows: readonly T[] = [];
  const store = createStore(
    createGridMachine({
      rowCount: () => sortedRows.length,
      colCount: () => columns.length,
      getRowKey: (i) => getRowKey(sortedRows[i]),
      getColumnIds: () => columns.map((c) => c.id),
      getSortField: (i) => (columns[i]?.sortable === false ? null : (columns[i]?.id ?? null)),
      selectionMode: "multiple",
    }),
  );

  let virtualizer: Virtualizer = createVirtualizer({ count: 0, estimateSize: rowHeight });

  const resort = () => {
    sortedRows = sortRows(getRows(), store.getState().sort);
    virtualizer = createVirtualizer({ count: sortedRows.length, estimateSize: rowHeight });
    spacer.style.height = `${headerHeight + virtualizer.totalSize()}px`;
  };

  /* ---- DOM scaffold: scroller + spacer + sticky canvas ---- */
  container.style.position = "relative";
  container.style.overflow = "auto";
  container.tabIndex = 0;

  const spacer = document.createElement("div");
  spacer.style.cssText = `width:${totalWidth}px;pointer-events:none;`;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:sticky;top:0;left:0;display:block;pointer-events:none;";
  spacer.appendChild(canvas);
  container.appendChild(spacer);

  let theme = readTheme(container);

  /* ---- painting ---- */
  const paint = () => {
    const start = performance.now();
    const dpr = window.devicePixelRatio || 1;
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;
    if (canvas.width !== viewWidth * dpr || canvas.height !== viewHeight * dpr) {
      canvas.width = viewWidth * dpr;
      canvas.height = viewHeight * dpr;
      canvas.style.width = `${viewWidth}px`;
      canvas.style.height = `${viewHeight}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";

    const state = store.getState();
    const scrollTop = Math.max(0, container.scrollTop - 0);
    const scrollLeft = container.scrollLeft;
    const range = virtualizer.range(Math.max(0, scrollTop), viewHeight - headerHeight);

    /* rows */
    for (const item of range.items) {
      const row = sortedRows[item.index];
      if (row === undefined) continue;
      const y = headerHeight + item.start - scrollTop;
      if (y + item.size < headerHeight || y > viewHeight) continue;
      const selected = state.selectedRows.has(getRowKey(row));
      ctx.fillStyle = selected
        ? theme.selectedBackground
        : item.index % 2
          ? theme.zebra
          : theme.background;
      ctx.fillRect(0, y, viewWidth, item.size);
      ctx.strokeStyle = theme.border;
      ctx.beginPath();
      ctx.moveTo(0, y + item.size - 0.5);
      ctx.lineTo(viewWidth, y + item.size - 0.5);
      ctx.stroke();

      let x = -scrollLeft;
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        if (x + col.width > 0 && x < viewWidth) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + 4, y, col.width - 8, item.size);
          ctx.clip();
          ctx.fillStyle = theme.text;
          ctx.textAlign = col.align === "right" ? "right" : "left";
          ctx.fillText(
            col.getText(row),
            col.align === "right" ? x + col.width - 10 : x + 10,
            y + item.size / 2,
          );
          ctx.restore();
          if (state.cursor && state.cursor.row === item.index && state.cursor.col === c) {
            ctx.strokeStyle = theme.cursor;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, col.width - 2, item.size - 2);
            ctx.lineWidth = 1;
          }
        }
        x += col.width;
      }
    }

    /* header (painted last, on top) */
    ctx.fillStyle = theme.headerBackground;
    ctx.fillRect(0, 0, viewWidth, headerHeight);
    ctx.strokeStyle = theme.border;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight - 0.5);
    ctx.lineTo(viewWidth, headerHeight - 0.5);
    ctx.stroke();
    let hx = -scrollLeft;
    ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
    for (const col of columns) {
      if (hx + col.width > 0 && hx < viewWidth) {
        ctx.fillStyle = theme.mutedText;
        ctx.textAlign = col.align === "right" ? "right" : "left";
        const sortIndex = store.getState().sort.findIndex((s) => s.field === col.id);
        const spec = sortIndex >= 0 ? store.getState().sort[sortIndex] : undefined;
        const label = spec ? `${col.header} ${spec.direction === "asc" ? "▲" : "▼"}` : col.header;
        ctx.fillText(
          label,
          col.align === "right" ? hx + col.width - 10 : hx + 10,
          headerHeight / 2,
        );
      }
      hx += col.width;
    }
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";

    onPaint?.({
      ms: performance.now() - start,
      rowsPainted: range.items.length,
      totalRows: sortedRows.length,
    });
  };

  let frame = 0;
  const schedulePaint = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(paint);
  };

  /* ---- input: same intents, no React ---- */
  const hitTest = (e: MouseEvent): { row: number; col: number } | { header: number } | null => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top;
    let col = -1;
    let acc = 0;
    for (let c = 0; c < columns.length; c++) {
      acc += columns[c].width;
      if (x < acc) {
        col = c;
        break;
      }
    }
    if (col === -1) return null;
    if (y < headerHeight) return { header: col };
    const index = virtualizer.indexAt(container.scrollTop + (y - headerHeight));
    return index < sortedRows.length ? { row: index, col } : null;
  };

  const onPointerDown = (e: PointerEvent) => {
    container.focus();
    const hit = hitTest(e);
    if (!hit) return;
    if ("header" in hit) {
      const col = columns[hit.header];
      if (col.sortable !== false) {
        store.dispatch(gridIntents.toggleSort({ field: col.id, additive: e.shiftKey }, "pointer"));
      }
      return;
    }
    store.dispatch(gridIntents.moveTo({ row: hit.row, col: hit.col }, "pointer"));
    store.dispatch(
      gridIntents.selectRow(
        { row: hit.row, toggle: e.ctrlKey || e.metaKey, extend: e.shiftKey },
        "pointer",
      ),
    );
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const resolved = resolveBinding(GRID_KEYMAP, strokeFromKeyboardEvent(e));
    if (!resolved) return;
    if (resolved.binding.preventDefault !== false) e.preventDefault();
    store.dispatch(resolved.intent);
  };

  /* ---- wiring ---- */
  const unsubscribeState = store.subscribe(() => {
    // Sort spec changes reorder the row universe before repainting.
    sortedRows = sortRows(getRows(), store.getState().sort);
    options.onSelectionChange?.(store.getState().selectedRows.size);
    schedulePaint();
  });
  const unsubscribeEffects = store.onEffect((effect) => {
    if (scrollToItem.match(effect)) {
      const index = Number(effect.payload.key);
      if (!Number.isFinite(index)) return;
      container.scrollTop = virtualizer.scrollOffsetFor(
        index,
        container.clientHeight - headerHeight,
        container.scrollTop,
      );
      schedulePaint();
    }
  });

  container.addEventListener("scroll", schedulePaint, { passive: true });
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("keydown", onKeyDown);
  const resizeObserver = new ResizeObserver(() => {
    theme = readTheme(container);
    schedulePaint();
  });
  resizeObserver.observe(container);

  resort();
  schedulePaint();

  return {
    store,
    refresh() {
      resort();
      schedulePaint();
    },
    destroy() {
      cancelAnimationFrame(frame);
      unsubscribeState();
      unsubscribeEffects();
      container.removeEventListener("scroll", schedulePaint);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("keydown", onKeyDown);
      resizeObserver.disconnect();
      spacer.remove();
    },
  };
}
