import type { MutableRefObject, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react';
import type { GridRenderColumn } from '@/core/collection/grid/render/types';
import type { SortSpec } from '@/core/collection/grid/state/types';
import { GridHeaderCell } from './GridHeaderCell';
import { GridHeaderDndOverlay } from './GridHeaderDndOverlay';
import { GridHeaderDropIndicator } from './GridHeaderDropIndicator';

type GridHeaderRowProps = {
  columns: GridRenderColumn[];
  sortableColumnIds: Set<string>;
  sortSpecByColumnId: Map<string, SortSpec>;
  draggedHeaderIds: Set<string>;
  activeDraggedHeaderColumn: GridRenderColumn | null;
  activeDraggedHeaderIndex: number;
  headerDndVisual: {
    isDragging: boolean;
  };
  dragPointer: {
    anchorClientX: number;
    anchorClientY: number;
    currentClientX: number;
    currentClientY: number;
  } | null;
  headerDragOverlaySnapshot: {
    columnId: string;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  headerDropIndicator: {
    left: number;
    height: number;
  } | null;
  headerRowRef: RefObject<HTMLDivElement>;
  headerViewportRef: RefObject<HTMLDivElement>;
  headerCellRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onHeaderClick: (columnId: string) => void;
  onHeaderPointerDown: (columnId: string, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onHeaderMouseDown: (columnId: string, event: ReactMouseEvent<HTMLSpanElement>) => void;
  onResizePointerDown: (columnId: string, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onResizeMouseDown: (columnId: string, event: ReactMouseEvent<HTMLSpanElement>) => void;
  activeResizeColumnId: string | null;
};

export function GridHeaderRow({
  columns,
  sortableColumnIds,
  sortSpecByColumnId,
  draggedHeaderIds,
  activeDraggedHeaderColumn,
  activeDraggedHeaderIndex,
  headerDndVisual,
  dragPointer,
  headerDragOverlaySnapshot,
  headerDropIndicator,
  headerRowRef,
  headerViewportRef,
  headerCellRefs,
  onHeaderClick,
  onHeaderPointerDown,
  onHeaderMouseDown,
  onResizePointerDown,
  onResizeMouseDown,
  activeResizeColumnId,
}: GridHeaderRowProps) {
  return (
    <>
      <div
        ref={headerViewportRef}
        className="relative overflow-hidden border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground"
      >
        <div
          ref={headerRowRef}
          className="flex min-w-full w-max"
          role="row"
        >
          {columns.map((col, index) => {
            const sortEntry = sortSpecByColumnId.get(col.id);
            const isSortable = sortableColumnIds.has(col.id);
            const isDragged = draggedHeaderIds.has(col.id);
            return (
              <GridHeaderCell
                key={col.id}
                cellRef={(node) => {
                  if (node) {
                    headerCellRefs.current.set(col.id, node);
                  } else {
                    headerCellRefs.current.delete(col.id);
                  }
                }}
                headerText={col.headerText}
                align={col.align}
                width={col.width}
                minWidth={col.minWidth}
                maxWidth={col.maxWidth}
                showTrailingSeparator={index < columns.length - 1}
                isSortable={isSortable}
                sortDirection={sortEntry?.direction}
                isDragged={isDragged}
                isResizing={activeResizeColumnId === col.id}
                onClick={() => onHeaderClick(col.id)}
                onHandlePointerDown={(event) => onHeaderPointerDown(col.id, event)}
                onHandleMouseDown={(event) => onHeaderMouseDown(col.id, event)}
                onResizePointerDown={(event) => onResizePointerDown(col.id, event)}
                onResizeMouseDown={(event) => onResizeMouseDown(col.id, event)}
                dragHandleCursor={isDragged ? 'grabbing' : 'grab'}
              />
            );
          })}
        </div>
        <GridHeaderDropIndicator
          active={headerDropIndicator != null}
          left={headerDropIndicator?.left ?? 0}
          height={headerDropIndicator?.height ?? 0}
        />
      </div>

      <GridHeaderDndOverlay
        active={headerDndVisual.isDragging && activeDraggedHeaderColumn != null}
        sourceRect={headerDragOverlaySnapshot}
        pointer={dragPointer}
        headerText={activeDraggedHeaderColumn?.headerText ?? ''}
        align={activeDraggedHeaderColumn?.align}
        width={activeDraggedHeaderColumn?.width}
        minWidth={activeDraggedHeaderColumn?.minWidth}
        maxWidth={activeDraggedHeaderColumn?.maxWidth}
        showTrailingSeparator={activeDraggedHeaderIndex >= 0 && activeDraggedHeaderIndex < columns.length - 1}
        isSortable={activeDraggedHeaderColumn != null && sortableColumnIds.has(activeDraggedHeaderColumn.id)}
        sortDirection={activeDraggedHeaderColumn == null ? undefined : sortSpecByColumnId.get(activeDraggedHeaderColumn.id)?.direction}
      />
    </>
  );
}



