import { act, fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDndEngine } from '../../../core/dnd';
import type { DndAdapter, DropTarget } from '../../../core/dnd';
import { usePointerDnd } from './usePointerDnd';

type TestContext = {
  sourceKey: string;
};

type TestGeometry = {
  target: DropTarget;
};

type TestIntent = {
  kind: 'drop';
  targetKey?: string;
  zone: DropTarget['zone'];
};

function createAdapter(): DndAdapter<TestContext, TestGeometry, TestIntent> {
  return {
    getDragPayload: (ctx) => ({
      version: '1.0',
      headers: { contentType: 'grid/columns' },
      data: { items: [{ id: ctx.sourceKey, type: 'grid.column' }] },
    }),
    hitTest: ({ geometry }) => geometry.target,
    toIntent: ({ target }) => ({
      kind: 'drop',
      targetKey: target.targetKey,
      zone: target.zone,
    }),
  };
}

describe('usePointerDnd', () => {
  it('begins a pointer drag and exposes the engine visual state', () => {
    const geometryRef = {
      current: { target: { targetKey: 'col-b', zone: 'before' as const } },
    };
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    const { result } = renderHook(() =>
      usePointerDnd({
        engine,
        getGeometry: () => geometryRef.current,
      }),
    );

    act(() => {
      result.current.beginPointerDrag({
        ctx: { sourceKey: 'col-a' },
        pointerClientX: 10,
        pointerClientY: 5,
      });
    });

    expect(result.current.state.phase).toBe('idle');

    act(() => {
      fireEvent.mouseMove(window, { clientX: 20, clientY: 5 });
    });

    expect(result.current.state.phase).toBe('dragging');
    expect(result.current.dragPointer).toEqual({
      anchorClientX: 20,
      anchorClientY: 5,
      currentClientX: 20,
      currentClientY: 5,
    });
    expect(result.current.visual.payload?.data.items).toEqual([
      { id: 'col-a', type: 'grid.column' },
    ]);
    expect(result.current.visual.over).toEqual({
      targetKey: 'col-b',
      zone: 'before',
    });
  });

  it('updates the visual target on window pointermove', () => {
    const geometryRef = {
      current: { target: { targetKey: 'col-b', zone: 'before' as const } },
    };
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    const { result } = renderHook(() =>
      usePointerDnd({
        engine,
        getGeometry: () => geometryRef.current,
      }),
    );

    act(() => {
      result.current.beginPointerDrag({
        ctx: { sourceKey: 'col-a' },
        pointerClientX: 10,
        pointerClientY: 5,
      });
    });

    act(() => {
      fireEvent.mouseMove(window, { clientX: 20, clientY: 5 });
    });

    geometryRef.current = { target: { targetKey: 'col-c', zone: 'after' } };

    act(() => {
      fireEvent.mouseMove(window, { clientX: 50, clientY: 8 });
    });

    expect(result.current.dragPointer).toEqual({
      anchorClientX: 20,
      anchorClientY: 5,
      currentClientX: 50,
      currentClientY: 8,
    });
    expect(result.current.visual.over).toEqual({
      targetKey: 'col-c',
      zone: 'after',
    });
  });

  it('resolves the drop intent on window pointerup', () => {
    const geometryRef = {
      current: { target: { targetKey: 'col-b', zone: 'before' as const } },
    };
    const onIntentResolved = vi.fn();
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    const { result } = renderHook(() =>
      usePointerDnd({
        engine,
        getGeometry: () => geometryRef.current,
        onIntentResolved,
      }),
    );

    act(() => {
      result.current.beginPointerDrag({
        ctx: { sourceKey: 'col-a' },
        pointerClientX: 10,
        pointerClientY: 5,
      });
    });

    act(() => {
      fireEvent.mouseMove(window, { clientX: 20, clientY: 5 });
    });

    act(() => {
      fireEvent.mouseUp(window, { clientX: 50, clientY: 8 });
    });

    expect(onIntentResolved).toHaveBeenCalledWith({
      kind: 'drop',
      targetKey: 'col-b',
      zone: 'before',
    });
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.dragPointer).toBeNull();
  });

  it('cancels the drag on Escape', () => {
    const geometryRef = {
      current: { target: { targetKey: 'col-b', zone: 'before' as const } },
    };
    const onIntentResolved = vi.fn();
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    const { result } = renderHook(() =>
      usePointerDnd({
        engine,
        getGeometry: () => geometryRef.current,
        onIntentResolved,
      }),
    );

    act(() => {
      result.current.beginPointerDrag({
        ctx: { sourceKey: 'col-a' },
        pointerClientX: 10,
        pointerClientY: 5,
      });
    });

    act(() => {
      fireEvent.mouseMove(window, { clientX: 20, clientY: 5 });
    });

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(result.current.state.phase).toBe('idle');
    expect(result.current.dragPointer).toBeNull();
    expect(onIntentResolved).not.toHaveBeenCalled();
  });

  it('does not start a drag while movement stays below the threshold', () => {
    const geometryRef = {
      current: { target: { targetKey: 'col-b', zone: 'before' as const } },
    };
    const onIntentResolved = vi.fn();
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    const { result } = renderHook(() =>
      usePointerDnd({
        engine,
        getGeometry: () => geometryRef.current,
        onIntentResolved,
      }),
    );

    act(() => {
      result.current.beginPointerDrag({
        ctx: { sourceKey: 'col-a' },
        pointerClientX: 10,
        pointerClientY: 10,
      });
    });

    act(() => {
      fireEvent.mouseMove(window, { clientX: 13, clientY: 12 });
      fireEvent.mouseUp(window, { clientX: 13, clientY: 12 });
    });

    expect(result.current.state.phase).toBe('idle');
    expect(result.current.visual.isDragging).toBe(false);
    expect(result.current.dragPointer).toBeNull();
    expect(onIntentResolved).not.toHaveBeenCalled();
  });
});
