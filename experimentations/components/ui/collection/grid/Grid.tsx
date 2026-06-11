import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement, Ref, UIEvent } from 'react';
import type { GridRenderColumn } from '@/core/collection/grid/render/types';
import type { FilterExpr, SortSpec } from '@/core/collection/grid/state/types';
import type { ColumnDef } from '@/core/collection/grid/definition/column';
import { toGridConfig, type GridConfig, type GridDefinition } from '@/core/collection/grid/definition/facade';
import type { GridEffect } from '@/core/collection/grid/effects/types';
import type { GridIntent } from '@/core/collection/grid/intents/types';
import { GRID_OVERSCAN_DEFAULT } from '@/core/collection/grid/constants';
import type { ItemId } from '@/core/collection/shared/runtime';
import { CollectionCache } from '@/core/collection/shared/cache';
import { useCollectionController } from '@/components/ui/collection/shared/hooks';
import {
  CollectionViewport,
  type CollectionViewportHandle,
  type CollectionViewportRowTone,
} from '@/components/ui/collection/shared/components';
import { GridHeaderRow, useGridHeaderDnd, useGridHeaderResize } from './header';
import { getVisibleIndexFromEventTarget } from '@/components/ui/collection/virtual/eventTarget';
import { GRID_DEFAULT_HEIGHT, GRID_DEFAULT_WIDTH } from './constants';
import { useGridModel } from './hooks/useGridModel';
import './grid.css';

function nextSortDirection(current: 'asc' | 'desc' | null): 'asc' | 'desc' | null {
  if (current === null) return 'asc';
  if (current === 'asc') return 'desc';
  return null;
}

function buildNextSortSpec(currentSortSpec: SortSpec[], columnId: string): SortSpec[] {
  const current = currentSortSpec.find((entry) => entry.columnId === columnId);
  const nextDirection = nextSortDirection(current?.direction ?? null);

  if (nextDirection == null) {
    return currentSortSpec.filter((entry) => entry.columnId !== columnId);
  }

  return [
    ...currentSortSpec.filter((entry) => entry.columnId !== columnId),
    { columnId, direction: nextDirection },
  ];
}

function reorderKeys(keys: string[], draggedKeys: string[], insertIndex: number): string[] {
  const draggedSet = new Set(draggedKeys);
  const remaining = keys.filter((key) => !draggedSet.has(key));
  const clampedIndex = Math.max(0, Math.min(insertIndex, remaining.length));
  return [
    ...remaining.slice(0, clampedIndex),
    ...draggedKeys.filter((key) => keys.includes(key)),
    ...remaining.slice(clampedIndex),
  ];
}

function withWidthOverride<TItem, TId extends ItemId>(
  column: ColumnDef<TItem, TId>,
  width: number | undefined,
): ColumnDef<TItem, TId> {
  if (width == null) {
    return column;
  }

  const baseGetStyle = column.cell.getStyle;

  return {
    ...column,
    view: {
      ...column.view,
      width,
    },
    cell: {
      ...column.cell,
      getStyle: (item, id, runtime, value, displayValue, culture) => ({
        ...(baseGetStyle?.(item, id, runtime, value, displayValue, culture) ?? {}),
        width: `${width}px`,
        flex: `0 0 ${width}px`,
      }),
    },
  };
}

export interface GridHandle {
  setSort: (spec: SortSpec[]) => void;
  setFilter: (expr: FilterExpr | null) => void;
}

export interface GridProps<TItem, TId extends ItemId = ItemId> {
  rows: TItem[];
  definition: GridDefinition<TItem, TId> | GridConfig<TItem, TId>;
  isLoading?: boolean;
  height?: number;
  width?: string | number;
  rowTone?: CollectionViewportRowTone;
  onSelectionChange?: (selectedIds: Set<TId>) => void;
  onCheckedChange?: (checkedIds: Set<TId>) => void;
  onLastIntent?: (intent: GridIntent<TId>) => void;
  onLastEffect?: (effect: GridEffect<TId>) => void;
  onSortChange?: (spec: SortSpec[]) => void;
  onFilterChange?: (expr: FilterExpr | null) => void;
  onExecuteRowAction?: (itemId: TId, actionId: string) => void;
}

function GridInnerImpl<TItem, TId extends ItemId>(
  {
    rows,
    definition,
    isLoading = false,
    height = GRID_DEFAULT_HEIGHT,
    width = GRID_DEFAULT_WIDTH,
    rowTone = 'default',
    onSelectionChange,
    onCheckedChange,
    onLastIntent,
    onLastEffect,
    onSortChange,
    onFilterChange,
    onExecuteRowAction,
  }: GridProps<TItem, TId>,
  ref: Ref<GridHandle>,
) {
  const [sortSpec, setSortSpec] = useState<SortSpec[]>([]);
  const [filterExpr, setFilterExpr] = useState<FilterExpr | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Map<string, number>>(() => new Map());
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const bodyScrollLeftRef = useRef(0);
  const headerScrollRafRef = useRef<number | null>(null);
  const listRef = useRef<CollectionViewportHandle | null>(null);
  const cacheRef = useRef(new CollectionCache<TId>());

  const baseConfig = useMemo(
    () => toGridConfig(definition),
    [definition],
  );
  const baseColumnIds = useMemo(
    () => baseConfig.columns.map((column) => column.id),
    [baseConfig.columns],
  );

  useEffect(() => {
    setColumnOrder((prev) => {
      if (prev.length === 0) {
        return [...baseColumnIds];
      }

      const currentKeys = new Set(baseColumnIds);
      const preserved = prev.filter((key) => currentKeys.has(key));
      const missing = baseColumnIds.filter((key) => !preserved.includes(key));
      const next = [...preserved, ...missing];

      if (next.length === prev.length && next.every((key, index) => key === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [baseColumnIds]);

  const orderedColumnIds = useMemo(() => {
    const ids = columnOrder.length > 0 ? columnOrder : baseColumnIds;
    const current = new Set(baseColumnIds);
    const preserved = ids.filter((id) => current.has(id));
    const missing = baseColumnIds.filter((id) => !preserved.includes(id));
    return [...preserved, ...missing];
  }, [columnOrder, baseColumnIds]);

  const orderedColumns = useMemo(() => {
    const byId = new Map(baseConfig.columns.map((column) => [column.id, column]));
    return orderedColumnIds
      .map((id) => byId.get(id))
      .filter((column): column is ColumnDef<TItem, TId> => column != null)
      .map((column) => withWidthOverride(column, columnWidthOverrides.get(column.id)));
  }, [baseConfig.columns, orderedColumnIds, columnWidthOverrides]);

  const modelDefinition = useMemo<GridDefinition<TItem, TId>>(() => ({
    columns: orderedColumns,
    getRowId: baseConfig.getRowId,
    getRowKind: baseConfig.getRowKind,
    hierarchy: baseConfig.hierarchy,
    capabilities: baseConfig.capabilities,
    culture: baseConfig.culture,
    rowHeight: baseConfig.rowHeight,
    kindMap: baseConfig.kindMap,
  }), [orderedColumns, baseConfig]);

  const {
    config,
    listDefinition,
    visibleRows,
    headerColumns,
  } = useGridModel({
    rows,
    definition: modelDefinition,
    sortSpec,
    filterExpr,
  });

  const listController = useCollectionController({
    items: visibleRows,
    definition: listDefinition,
    cache: cacheRef.current,
    onLastIntent: (intent) => onLastIntent?.(intent as GridIntent<TId>),
    onLastEffect: (effect) => onLastEffect?.(effect as GridEffect<TId>),
    onFocusDomItem: () => {
      listRef.current?.focus();
    },
    onScrollToItem: (itemId, align) => {
      listRef.current?.scrollToItem(itemId, align);
    },
    onSelectionChange,
  });

  const sortSpecByColumnId = useMemo(
    () => new Map(sortSpec.map((entry) => [entry.columnId, entry])),
    [sortSpec],
  );

  const sortableColumnIds = useMemo(
    () => new Set(config.columnCoreDefs.filter((column) => column.sortable).map((column) => column.id)),
    [config.columnCoreDefs],
  );

  const orderedRenderColumns = useMemo<GridRenderColumn[]>(
    () => headerColumns.map((column) => ({
      id: column.id,
      headerText: column.headerText,
      width: column.width,
      minWidth: column.minWidth,
      maxWidth: column.maxWidth,
      align: column.align,
    })),
    [headerColumns],
  );

  const emitSort = useCallback((next: SortSpec[]) => {
    onLastIntent?.({ type: 'SET_SORT', spec: next });
    setSortSpec(next);
    onSortChange?.(next);
  }, [onLastIntent, onSortChange]);

  const emitFilter = useCallback((next: FilterExpr | null) => {
    onLastIntent?.({ type: 'SET_FILTER', expr: next });
    setFilterExpr(next);
    onFilterChange?.(next);
  }, [onLastIntent, onFilterChange]);

  useImperativeHandle(ref, () => ({
    setSort: emitSort,
    setFilter: emitFilter,
  }), [emitFilter, emitSort]);

  const {
    headerRowRef,
    headerViewportRef,
    headerCellRefs,
    headerDndVisual,
    dragPointer,
    draggedHeaderIds,
    activeDraggedHeaderColumn,
    activeDraggedHeaderIndex,
    headerDragOverlaySnapshot,
    headerDropIndicator,
    handleHeaderClick,
    handleHeaderPointerDown,
    handleHeaderMouseDown,
  } = useGridHeaderDnd({
    orderedColumnIds,
    orderedRenderColumns,
    sortableColumnIds,
    onColumnsReordered: (draggedKeys, insertIndex) => {
      onLastIntent?.({
        type: 'REORDER_COLUMNS',
        draggedKeys,
        insertIndex,
      });
      setColumnOrder((prev) => reorderKeys(prev.length > 0 ? prev : orderedColumnIds, draggedKeys, insertIndex));
    },
    onHeaderSortClick: (columnId) => {
      emitSort(buildNextSortSpec(sortSpec, columnId));
    },
  });

  const scheduleHeaderScrollSync = useCallback(() => {
    if (headerScrollRafRef.current != null) {
      return;
    }

    headerScrollRafRef.current = requestAnimationFrame(() => {
      headerScrollRafRef.current = null;
      const headerRowEl = headerRowRef.current;
      if (!headerRowEl) {
        return;
      }

      headerRowEl.style.transform = `translate3d(-${bodyScrollLeftRef.current}px, 0, 0)`;
    });
  }, [headerRowRef]);

  useEffect(() => {
    const headerRowEl = headerRowRef.current;
    if (!headerRowEl) {
      return;
    }
    headerRowEl.style.transform = `translate3d(-${bodyScrollLeftRef.current}px, 0, 0)`;
  }, [headerRowRef, orderedRenderColumns]);

  useEffect(() => () => {
    if (headerScrollRafRef.current != null) {
      cancelAnimationFrame(headerScrollRafRef.current);
      headerScrollRafRef.current = null;
    }
  }, []);

  const handleWidthPreview = useCallback((columnId: string, width: number) => {
    const headerEl = headerCellRefs.current?.get(columnId);
    if (headerEl) {
      headerEl.style.width = `${width}px`;
      headerEl.style.minWidth = `${width}px`;
      headerEl.style.maxWidth = `${width}px`;
      headerEl.style.flex = `0 0 ${width}px`;
    }
    const cells = gridContainerRef.current?.querySelectorAll<HTMLDivElement>(
      `[data-column-id="${columnId}"]`,
    );
    cells?.forEach((cell) => {
      cell.style.width = `${width}px`;
      cell.style.flex = `0 0 ${width}px`;
    });
  }, [headerCellRefs]);

  const handleWidthCommit = useCallback((columnId: string, width: number) => {
    onLastIntent?.({ type: 'RESIZE_COLUMN', columnId, width });
    setColumnWidthOverrides((prev) => {
      const next = new Map(prev);
      next.set(columnId, width);
      return next;
    });
  }, [onLastIntent]);

  const {
    activeResizeColumnId,
    handleResizePointerDown,
    handleResizeMouseDown,
  } = useGridHeaderResize({
    columns: orderedRenderColumns,
    headerCellRefs,
    onWidthPreview: handleWidthPreview,
    onWidthCommit: handleWidthCommit,
  });

  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const actionEl = target?.closest<HTMLElement>('[data-grid-action]');
    if (!actionEl) {
      return;
    }

    const actionId = actionEl.dataset.gridAction;
    if (!actionId) {
      return;
    }

    const visibleIndex = getVisibleIndexFromEventTarget(actionEl);
    if (visibleIndex == null) {
      return;
    }

    const itemId = listController.model.derived.visibleItemIds[visibleIndex];
    if (itemId == null) {
      return;
    }

    onLastIntent?.({
      type: 'EXECUTE_ROW_ACTION',
      itemId,
      actionId,
    });
    onLastEffect?.({
      type: 'EMIT_ROW_ACTION',
      itemId,
      actionId,
    });
    onExecuteRowAction?.(itemId, actionId);
  }, [onLastIntent, onLastEffect, onExecuteRowAction, listController.model.derived.visibleItemIds]);

  const handleScrollCapture = useCallback((event: UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.dataset.testid !== 'virtual-pool-scroll') {
      return;
    }

    const next = target.scrollLeft;
    if (bodyScrollLeftRef.current === next) {
      return;
    }

    bodyScrollLeftRef.current = next;
    scheduleHeaderScrollSync();
  }, [scheduleHeaderScrollSync]);

  return (
    <div
      ref={gridContainerRef}
      className="grid-root rounded-md border border-border bg-card text-card-foreground overflow-hidden"
      style={{ width }}
      onClickCapture={handleClickCapture}
      onScrollCapture={handleScrollCapture}
    >
      <GridHeaderRow
        columns={orderedRenderColumns}
        sortableColumnIds={sortableColumnIds}
        sortSpecByColumnId={sortSpecByColumnId}
        draggedHeaderIds={draggedHeaderIds}
        activeDraggedHeaderColumn={activeDraggedHeaderColumn}
        activeDraggedHeaderIndex={activeDraggedHeaderIndex}
        headerDndVisual={headerDndVisual}
        dragPointer={dragPointer}
        headerDragOverlaySnapshot={headerDragOverlaySnapshot}
        headerDropIndicator={headerDropIndicator}
        headerRowRef={headerRowRef}
        headerViewportRef={headerViewportRef}
        headerCellRefs={headerCellRefs}
        onHeaderClick={handleHeaderClick}
        onHeaderPointerDown={handleHeaderPointerDown}
        onHeaderMouseDown={handleHeaderMouseDown}
        onResizePointerDown={handleResizePointerDown}
        onResizeMouseDown={handleResizeMouseDown}
        activeResizeColumnId={activeResizeColumnId}
      />

      <CollectionViewport
        ref={listRef}
        definition={listDefinition}
        listState={listController.collectionState}
        model={listController.model}
        dispatchIntent={listController.dispatchIntent}
        handleKeyDown={listController.handleKeyDown}
        isLoading={isLoading}
        height={height}
        overscan={GRID_OVERSCAN_DEFAULT}
        context="grid"
        rowTone={rowTone}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export const Grid = forwardRef(GridInnerImpl) as <TItem, TId extends ItemId = ItemId>(
  props: GridProps<TItem, TId> & { ref?: Ref<GridHandle> }
) => ReactElement;




