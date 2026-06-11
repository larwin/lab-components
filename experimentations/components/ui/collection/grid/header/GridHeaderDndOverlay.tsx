import { createPortal } from 'react-dom';
import { GridHeaderCell } from './GridHeaderCell';

type HeaderOverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type HeaderOverlayPointer = {
  anchorClientX: number;
  anchorClientY: number;
  currentClientX: number;
  currentClientY: number;
};

type GridHeaderDndOverlayProps = {
  active: boolean;
  sourceRect: HeaderOverlayRect | null;
  pointer: HeaderOverlayPointer | null;
  headerText: string;
  align?: 'left' | 'center' | 'right';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  showTrailingSeparator?: boolean;
  isSortable: boolean;
  sortDirection?: 'asc' | 'desc';
};

export function GridHeaderDndOverlay({
  active,
  sourceRect,
  pointer,
  headerText,
  align,
  width,
  minWidth,
  maxWidth,
  showTrailingSeparator = false,
  isSortable,
  sortDirection,
}: GridHeaderDndOverlayProps) {
  if (!active || sourceRect == null || pointer == null || typeof document === 'undefined') {
    return null;
  }

  const deltaX = pointer.currentClientX - pointer.anchorClientX;
  const left = sourceRect.left + deltaX;

  return createPortal(
    <div
      data-grid-header-dnd-overlay="true"
      className="overflow-hidden border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground"
      style={{
        position: 'fixed',
        left,
        top: sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <GridHeaderCell
        headerText={headerText}
        align={align}
        width={width}
        minWidth={minWidth}
        maxWidth={maxWidth}
        showTrailingSeparator={showTrailingSeparator}
        isSortable={isSortable}
        sortDirection={sortDirection}
        isDragged={false}
        floating
        dragHandleCursor="grabbing"
      />
    </div>,
    document.body,
  );
}



