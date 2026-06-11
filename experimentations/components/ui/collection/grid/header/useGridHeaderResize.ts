import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GridRenderColumn } from '@/core/collection/grid/render/types';

type ResizeSession = {
  columnId: string;
  startClientX: number;
  startWidth: number;
  minWidth: number;
  maxWidth: number;
};

type UseGridHeaderResizeArgs = {
  columns: GridRenderColumn[];
  headerCellRefs: RefObject<Map<string, HTMLDivElement>>;
  onWidthPreview: (columnId: string, width: number) => void;
  onWidthCommit?: (columnId: string, width: number) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useGridHeaderResize({
  columns,
  headerCellRefs,
  onWidthPreview,
  onWidthCommit,
}: UseGridHeaderResizeArgs) {
  const [activeResizeColumnId, setActiveResizeColumnId] = useState<string | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const lastPreviewWidthRef = useRef<number | null>(null);

  const beginResize = useCallback((columnId: string, clientX: number) => {
    const column = columns.find((entry) => entry.id === columnId);
    const headerEl = headerCellRefs.current?.get(columnId);
    if (!column || !headerEl) {
      return;
    }

    const rect = headerEl.getBoundingClientRect();
    const startWidth = Math.round(rect.width || column.width || column.minWidth || 120);
    resizeSessionRef.current = {
      columnId,
      startClientX: clientX,
      startWidth,
      minWidth: column.minWidth ?? 48,
      maxWidth: column.maxWidth ?? Number.POSITIVE_INFINITY,
    };
    lastPreviewWidthRef.current = startWidth;
    setActiveResizeColumnId(columnId);
  }, [columns, headerCellRefs]);

  const handleResizePointerDown = useCallback((columnId: string, event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    beginResize(columnId, event.clientX);
  }, [beginResize]);

  const handleResizeMouseDown = useCallback((columnId: string, event: ReactMouseEvent<HTMLSpanElement>) => {
    if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
    event.preventDefault();
    event.stopPropagation();
    beginResize(columnId, event.clientX);
  }, [beginResize]);

  useEffect(() => {
    const updateResize = (clientX: number) => {
      const session = resizeSessionRef.current;
      if (!session) {
        return;
      }

      const nextWidth = clamp(
        Math.round(session.startWidth + (clientX - session.startClientX)),
        session.minWidth,
        session.maxWidth,
      );
      lastPreviewWidthRef.current = nextWidth;
      onWidthPreview(session.columnId, nextWidth);
    };

    const endResize = () => {
      const session = resizeSessionRef.current;
      if (!session) {
        return;
      }

      const width = lastPreviewWidthRef.current ?? session.startWidth;
      onWidthCommit?.(session.columnId, width);
      resizeSessionRef.current = null;
      lastPreviewWidthRef.current = null;
      setActiveResizeColumnId(null);
    };

    const handlePointerMove = (event: PointerEvent) => updateResize(event.clientX);
    const handleMouseMove = (event: MouseEvent) => updateResize(event.clientX);
    const handlePointerUp = () => endResize();
    const handleMouseUp = () => endResize();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const session = resizeSessionRef.current;
      if (!session) return;
      onWidthPreview(session.columnId, session.startWidth);
      resizeSessionRef.current = null;
      lastPreviewWidthRef.current = null;
      setActiveResizeColumnId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onWidthCommit, onWidthPreview]);

  return {
    activeResizeColumnId,
    handleResizePointerDown,
    handleResizeMouseDown,
  };
}



