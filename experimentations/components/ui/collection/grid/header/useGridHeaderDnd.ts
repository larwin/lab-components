import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDndEngine, resolveReorder } from '@/core/dnd';
import { HeaderDndAdapter } from '@/core/collection/grid/dnd/header';
import type { GridRenderColumn } from '@/core/collection/grid/render/types';
import { usePointerDnd } from '@/components/ui/dnd';

type HeaderDragOverlaySnapshot = {
  columnId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type HeaderDropIndicator = {
  left: number;
  height: number;
};

type PointerLikeModifiers = {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};

type UseGridHeaderDndArgs = {
  orderedColumnIds: string[];
  orderedRenderColumns: GridRenderColumn[];
  sortableColumnIds: Set<string>;
  onColumnsReordered?: (draggedKeys: string[], insertIndex: number) => void;
  onHeaderSortClick: (columnId: string) => void;
};

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

function eventModifiersFromPointerLike(
  event: Pick<MouseEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
): PointerLikeModifiers {
  return {
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
}

export function useGridHeaderDnd({
  orderedColumnIds,
  orderedRenderColumns,
  sortableColumnIds,
  onColumnsReordered,
  onHeaderSortClick,
}: UseGridHeaderDndArgs) {
  const [headerDragOverlaySnapshot, setHeaderDragOverlaySnapshot] = useState<HeaderDragOverlaySnapshot | null>(null);
  const suppressNextHeaderClickRef = useRef(false);
  const headerRowRef = useRef<HTMLDivElement>(null);
  const headerViewportRef = useRef<HTMLDivElement>(null);
  const headerCellRefs = useRef(new Map<string, HTMLDivElement>());

  const headerDndEngine = useMemo(
    () => createDndEngine({ adapter: HeaderDndAdapter }),
    [],
  );

  const {
    visual: headerDndVisual,
    dragPointer,
    beginPointerDrag: beginHeaderPointerDrag,
  } = usePointerDnd({
    engine: headerDndEngine,
    getGeometry: () => ({
      orderedColKeys: orderedColumnIds,
      rects: orderedColumnIds
        .map((key) => {
          const el = headerCellRefs.current.get(key);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            key,
            left: rect.left,
            right: rect.right,
          };
        })
        .filter((rect): rect is { key: string; left: number; right: number } => rect != null),
    }),
    onIntentResolved: (intent) => {
      const next = reorderKeys(orderedColumnIds, intent.draggedKeys, intent.insertIndex);
      const changed = next.length !== orderedColumnIds.length
        || next.some((key, index) => key !== orderedColumnIds[index]);
      if (changed) {
        onColumnsReordered?.(intent.draggedKeys, intent.insertIndex);
      }
    },
  });

  const draggedHeaderIds = useMemo(
    () => new Set(
      headerDndVisual.payload?.data.items
        .filter((item) => item.type === 'grid.column')
        .map((item) => item.id) ?? [],
    ),
    [headerDndVisual.payload],
  );

  const activeDraggedHeaderId = useMemo(
    () => headerDndVisual.payload?.data.items.find((item) => item.type === 'grid.column')?.id ?? null,
    [headerDndVisual.payload],
  );

  const activeDraggedHeaderColumn = useMemo(
    () => activeDraggedHeaderId == null
      ? null
      : orderedRenderColumns.find((column) => column.id === activeDraggedHeaderId) ?? null,
    [activeDraggedHeaderId, orderedRenderColumns],
  );

  const activeDraggedHeaderIndex = useMemo(
    () => activeDraggedHeaderId == null
      ? -1
      : orderedRenderColumns.findIndex((column) => column.id === activeDraggedHeaderId),
    [activeDraggedHeaderId, orderedRenderColumns],
  );

  const headerDropIndicator = useMemo<HeaderDropIndicator | null>(() => {
    if (!headerDndVisual.isDragging || headerDndVisual.over == null || headerDndVisual.over.zone === 'none') {
      return null;
    }

    const draggedKeys = headerDndVisual.payload?.data.items
      .filter((item) => item.type === 'grid.column')
      .map((item) => item.id) ?? [];
    const reorderPreview = resolveReorder({
      draggedKeys,
      targetKey: headerDndVisual.over.targetKey,
      zone: headerDndVisual.over.zone,
      orderedKeys: orderedColumnIds,
    });
    if (!reorderPreview) {
      return null;
    }

    const nextOrder = reorderKeys(orderedColumnIds, draggedKeys, reorderPreview.insertIndex);
    const changed = nextOrder.length !== orderedColumnIds.length
      || nextOrder.some((key, index) => key !== orderedColumnIds[index]);
    if (!changed) {
      return null;
    }

    const targetKey = headerDndVisual.over.targetKey;
    if (!targetKey) {
      return null;
    }

    const targetEl = headerCellRefs.current.get(targetKey);
    const headerViewportEl = headerViewportRef.current;
    if (!targetEl || !headerViewportEl) {
      return null;
    }

    const targetRect = targetEl.getBoundingClientRect();
    const headerViewportRect = headerViewportEl.getBoundingClientRect();
    const left = (
      headerDndVisual.over.zone === 'before'
        ? targetRect.left
        : targetRect.right
    ) - headerViewportRect.left - 1;

    return {
      left,
      height: Math.max(8, targetRect.height - 8),
    };
  }, [headerDndVisual.isDragging, headerDndVisual.over, headerDndVisual.payload, orderedColumnIds]);

  useEffect(() => {
    if (!headerDndVisual.isDragging) {
      setHeaderDragOverlaySnapshot(null);
    }
  }, [headerDndVisual.isDragging]);

  const handleHeaderClick = useCallback((columnId: string) => {
    if (suppressNextHeaderClickRef.current) {
      suppressNextHeaderClickRef.current = false;
      return;
    }
    if (!sortableColumnIds.has(columnId)) return;
    onHeaderSortClick(columnId);
  }, [onHeaderSortClick, sortableColumnIds]);

  const beginHeaderDrag = useCallback((
    columnId: string,
    pointerClientX: number,
    pointerClientY: number,
    mods: PointerLikeModifiers,
  ) => {
    suppressNextHeaderClickRef.current = true;
    if (typeof window !== 'undefined') {
      const clearSuppressionAfterRelease = () => {
        window.setTimeout(() => {
          suppressNextHeaderClickRef.current = false;
        }, 0);
        window.removeEventListener('mouseup', clearSuppressionAfterRelease);
        window.removeEventListener('pointerup', clearSuppressionAfterRelease);
      };

      window.addEventListener('mouseup', clearSuppressionAfterRelease);
      window.addEventListener('pointerup', clearSuppressionAfterRelease);
    }

    const sourceRect = headerCellRefs.current.get(columnId)?.getBoundingClientRect();
    if (sourceRect) {
      setHeaderDragOverlaySnapshot({
        columnId,
        left: sourceRect.left,
        top: sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
      });
    }

    beginHeaderPointerDrag({
      ctx: { draggedColKeys: [columnId] },
      pointerClientX,
      pointerClientY,
      mods,
    });
  }, [beginHeaderPointerDrag]);

  const handleHeaderPointerDown = useCallback((columnId: string, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    beginHeaderDrag(columnId, event.clientX, event.clientY, eventModifiersFromPointerLike(event));
  }, [beginHeaderDrag]);

  const handleHeaderMouseDown = useCallback((columnId: string, event: ReactMouseEvent<HTMLSpanElement>) => {
    if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
    event.preventDefault();
    event.stopPropagation();
    beginHeaderDrag(columnId, event.clientX, event.clientY, eventModifiersFromPointerLike(event));
  }, [beginHeaderDrag]);

  return {
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
  };
}



