import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DndEngine,
  DndEngineState,
  ModifierKeys,
} from '../../../core/dnd';

type UsePointerDndOptions<TContext, TGeometry, TIntent> = {
  engine: DndEngine<TContext, TGeometry, TIntent>;
  getGeometry: () => TGeometry;
  onIntentResolved?: (intent: TIntent) => void;
  dragStartThreshold?: number;
};

type BeginPointerDragArgs<TContext> = {
  ctx: TContext;
  pointerClientX: number;
  pointerClientY: number;
  mods?: ModifierKeys;
};

export type PointerDragState = {
  anchorClientX: number;
  anchorClientY: number;
  currentClientX: number;
  currentClientY: number;
};

function eventToModifiers(event: Pick<MouseEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): ModifierKeys {
  return {
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
}

function mouseEventToModifiers(event: Pick<MouseEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>): ModifierKeys {
  return eventToModifiers(event);
}

export function usePointerDnd<TContext, TGeometry, TIntent>({
  engine,
  getGeometry,
  onIntentResolved,
  dragStartThreshold = 5,
}: UsePointerDndOptions<TContext, TGeometry, TIntent>) {
  const [state, setState] = useState<DndEngineState>(() => engine.getState());
  const [dragPointer, setDragPointer] = useState<PointerDragState | null>(null);
  const engineRef = useRef(engine);
  const getGeometryRef = useRef(getGeometry);
  const onIntentResolvedRef = useRef(onIntentResolved);
  const thresholdRef = useRef(dragStartThreshold);
  const pendingDragRef = useRef<BeginPointerDragArgs<TContext> | null>(null);

  engineRef.current = engine;
  getGeometryRef.current = getGeometry;
  onIntentResolvedRef.current = onIntentResolved;
  thresholdRef.current = dragStartThreshold;

  const syncState = useCallback(() => {
    setState(engineRef.current.getState());
  }, []);

  const beginPointerDrag = useCallback((args: BeginPointerDragArgs<TContext>) => {
    pendingDragRef.current = {
      ...args,
      mods: args.mods ?? {},
    };
  }, []);

  const cancelDrag = useCallback(() => {
    pendingDragRef.current = null;
    engineRef.current.cancelDrag();
    setDragPointer(null);
    syncState();
  }, [syncState]);

  useEffect(() => {
    const maybeBeginDrag = (pointerClientX: number, pointerClientY: number, mods: ModifierKeys) => {
      const pendingDrag = pendingDragRef.current;
      if (!pendingDrag) {
        return false;
      }

      const distance = Math.hypot(
        pointerClientX - pendingDrag.pointerClientX,
        pointerClientY - pendingDrag.pointerClientY,
      );

      if (distance < thresholdRef.current) {
        return false;
      }

      pendingDragRef.current = null;
      engineRef.current.beginDrag({
        ctx: pendingDrag.ctx,
        geometry: getGeometryRef.current(),
        pointerClientX,
        pointerClientY,
        mods,
      });
      setDragPointer({
        anchorClientX: pointerClientX,
        anchorClientY: pointerClientY,
        currentClientX: pointerClientX,
        currentClientY: pointerClientY,
      });
      syncState();
      return true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const mods = eventToModifiers(event);
      if (engineRef.current.getState().phase !== 'dragging') {
        maybeBeginDrag(event.clientX, event.clientY, mods);
      }
      if (engineRef.current.getState().phase !== 'dragging') return;
      engineRef.current.updatePointer({
        geometry: getGeometryRef.current(),
        pointerClientX: event.clientX,
        pointerClientY: event.clientY,
        mods,
      });
      setDragPointer((prev) => prev == null ? null : ({
        ...prev,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
      }));
      syncState();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pendingDragRef.current) {
        pendingDragRef.current = null;
        return;
      }
      if (engineRef.current.getState().phase !== 'dragging') return;
      const intent = engineRef.current.endDrag({
        geometry: getGeometryRef.current(),
        pointerClientX: event.clientX,
        pointerClientY: event.clientY,
        mods: eventToModifiers(event),
      });
      setDragPointer(null);
      syncState();
      if (intent) {
        onIntentResolvedRef.current?.(intent);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const mods = mouseEventToModifiers(event);
      if (engineRef.current.getState().phase !== 'dragging') {
        maybeBeginDrag(event.clientX, event.clientY, mods);
      }
      if (engineRef.current.getState().phase !== 'dragging') return;
      engineRef.current.updatePointer({
        geometry: getGeometryRef.current(),
        pointerClientX: event.clientX,
        pointerClientY: event.clientY,
        mods,
      });
      setDragPointer((prev) => prev == null ? null : ({
        ...prev,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
      }));
      syncState();
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (pendingDragRef.current) {
        pendingDragRef.current = null;
        return;
      }
      if (engineRef.current.getState().phase !== 'dragging') return;
      const intent = engineRef.current.endDrag({
        geometry: getGeometryRef.current(),
        pointerClientX: event.clientX,
        pointerClientY: event.clientY,
        mods: mouseEventToModifiers(event),
      });
      setDragPointer(null);
      syncState();
      if (intent) {
        onIntentResolvedRef.current?.(intent);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      pendingDragRef.current = null;
      if (engineRef.current.getState().phase !== 'dragging') return;
      engineRef.current.cancelDrag();
      setDragPointer(null);
      syncState();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [syncState]);

  return {
    state,
    visual: state.visual,
    dragPointer,
    beginPointerDrag,
    cancelDrag,
  };
}
