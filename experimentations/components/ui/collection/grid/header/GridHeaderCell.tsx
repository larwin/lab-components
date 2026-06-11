import { MaterialSymbol } from '@/components/ui/icons/MaterialSymbol';

type ColumnAlign = 'left' | 'center' | 'right' | undefined;

function justifyContentForAlign(align: ColumnAlign): string {
  if (align === 'center') return 'center';
  if (align === 'right') return 'flex-end';
  return 'flex-start';
}

function textAlignForAlign(align: ColumnAlign): 'left' | 'center' | 'right' {
  if (align === 'center') return 'center';
  if (align === 'right') return 'right';
  return 'left';
}

function alignItemsForAlign(align: ColumnAlign): string {
  if (align === 'center') return 'center';
  if (align === 'right') return 'flex-end';
  return 'flex-start';
}

function widthStyle(
  width?: number,
  minWidth?: number,
  maxWidth?: number,
): Pick<React.CSSProperties, 'flex' | 'width' | 'minWidth' | 'maxWidth'> {
  const style: Pick<React.CSSProperties, 'flex' | 'width' | 'minWidth' | 'maxWidth'> = {
    flex: width == null ? '1 1 0' : `0 0 ${width}px`,
  };

  if (width != null) style.width = width;
  if (minWidth != null) style.minWidth = minWidth;
  if (maxWidth != null) style.maxWidth = maxWidth;

  return style;
}

type GridHeaderCellProps = {
  headerText: string;
  align?: ColumnAlign;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  showTrailingSeparator?: boolean;
  isSortable: boolean;
  sortDirection?: 'asc' | 'desc';
  isDragged?: boolean;
  floating?: boolean;
  onClick?: () => void;
  cellRef?: (node: HTMLDivElement | null) => void;
  onHandlePointerDown?: React.PointerEventHandler<HTMLSpanElement>;
  onHandleMouseDown?: React.MouseEventHandler<HTMLSpanElement>;
  onResizePointerDown?: React.PointerEventHandler<HTMLSpanElement>;
  onResizeMouseDown?: React.MouseEventHandler<HTMLSpanElement>;
  dragHandleCursor?: 'grab' | 'grabbing';
  resizeHandleCursor?: 'col-resize';
  showResizeHandle?: boolean;
  isResizing?: boolean;
};

export function GridHeaderCell({
  headerText,
  align,
  width,
  minWidth,
  maxWidth,
  showTrailingSeparator = false,
  isSortable,
  sortDirection,
  isDragged = false,
  floating = false,
  onClick,
  cellRef,
  onHandlePointerDown,
  onHandleMouseDown,
  onResizePointerDown,
  onResizeMouseDown,
  dragHandleCursor = 'grab',
  resizeHandleCursor = 'col-resize',
  showResizeHandle = true,
  isResizing = false,
}: GridHeaderCellProps) {
  return (
    <div
      ref={cellRef}
      className={[
        'group relative flex flex-1 items-center gap-2 truncate px-3 py-2',
        floating ? 'shadow-lg ring-1 ring-border/80' : '',
      ].join(' ').trim()}
      data-grid-header-separator={showTrailingSeparator ? 'true' : 'false'}
      role="columnheader"
      onClick={onClick}
      style={{
        cursor: isSortable ? 'pointer' : 'default',
        userSelect: 'none',
        height: '100%',
        alignItems: alignItemsForAlign(align),
        opacity: isDragged ? 0.55 : 1,
        borderRight: showTrailingSeparator ? '1px solid hsl(var(--border) / 0.9)' : undefined,
        ...widthStyle(width, minWidth, maxWidth),
      }}
    >
      <span
        aria-hidden="true"
        data-grid-drag-handle="true"
        className="inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground/45 transition-colors group-hover:text-muted-foreground"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onHandlePointerDown}
        onMouseDown={onHandleMouseDown}
        style={{ cursor: dragHandleCursor }}
      >
        <MaterialSymbol name="drag_indicator" size={14} />
      </span>
      <span
        data-grid-header-content="true"
        className="flex min-w-0 flex-1 items-center gap-1 pr-2"
        style={{
          justifyContent: justifyContentForAlign(align),
          textAlign: textAlignForAlign(align),
        }}
      >
        <span className="truncate">{headerText}</span>
        {isSortable && (
          sortDirection
            ? (
                <MaterialSymbol
                  name={sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                  size={14}
                  className="text-muted-foreground/70"
                />
              )
            : <MaterialSymbol name="unfold_more" size={14} className="text-muted-foreground/35" />
        )}
      </span>
      {showResizeHandle && (
        <span
          aria-hidden="true"
          data-grid-resize-handle="true"
          className="absolute right-0 top-1/2 inline-flex h-full w-3 -translate-y-1/2 items-center justify-center text-muted-foreground/35 transition-colors group-hover:text-muted-foreground/60"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={onResizePointerDown}
          onMouseDown={onResizeMouseDown}
          style={{ cursor: resizeHandleCursor, opacity: isResizing ? 1 : undefined }}
        >
          <span
            className="h-4 w-px rounded-full bg-current"
            style={{ pointerEvents: 'none' }}
          />
        </span>
      )}
    </div>
  );
}



