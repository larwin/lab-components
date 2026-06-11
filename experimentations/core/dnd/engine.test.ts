import { describe, expect, it, vi } from 'vitest';
import { createDndEngine } from './engine';
import type { DndAdapter, DropTarget } from './types';

type TestContext = {
  sourceKey: string;
};

type TestGeometry = {
  target: DropTarget;
};

type TestIntent = {
  kind: 'drop';
  zone: DropTarget['zone'];
  effect: 'move' | 'copy' | 'link';
  sourceKey: string;
};

function createAdapter(): DndAdapter<TestContext, TestGeometry, TestIntent> {
  return {
    getDragPayload: (ctx) => ({
      version: '1.0',
      headers: {
        contentType: 'grid/columns',
        source: 'grid.headers',
      },
      data: {
        items: [{ id: ctx.sourceKey, type: 'test.item' }],
      },
    }),
    hitTest: ({ geometry }) => geometry.target,
    toIntent: ({ target, effect, ctx }) => ({
      kind: 'drop',
      zone: target.zone,
      effect,
      sourceKey: ctx.sourceKey,
    }),
  };
}

describe('createDndEngine', () => {
  it('starts in idle state', () => {
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    expect(engine.getState()).toEqual({
      phase: 'idle',
      visual: { isDragging: false },
    });
  });

  it('enters dragging state on beginDrag and exposes payload/effect', () => {
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    engine.beginDrag({
      ctx: { sourceKey: 'col-1' },
      geometry: { target: { targetKey: 'col-2', zone: 'before' } },
      pointerClientX: 10,
      pointerClientY: 20,
      mods: {},
    });

    expect(engine.getState()).toEqual({
      phase: 'dragging',
      visual: {
        isDragging: true,
        payload: {
          version: '1.0',
          headers: {
            contentType: 'grid/columns',
            source: 'grid.headers',
          },
          data: {
            items: [{ id: 'col-1', type: 'test.item' }],
          },
        },
        over: { targetKey: 'col-2', zone: 'before' },
        effect: 'move',
      },
    });
  });

  it('uses copy effect when ctrl or meta is pressed by default', () => {
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    engine.beginDrag({
      ctx: { sourceKey: 'col-1' },
      geometry: { target: { targetKey: 'col-2', zone: 'after' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: { ctrl: true },
    });
    expect(engine.getState().visual.effect).toBe('copy');

    engine.updatePointer({
      geometry: { target: { targetKey: 'col-3', zone: 'after' } },
      pointerClientX: 1,
      pointerClientY: 1,
      mods: { meta: true },
    });
    expect(engine.getState().visual.effect).toBe('copy');
  });

  it('uses policy.defaultEffect override when provided', () => {
    const engine = createDndEngine({
      adapter: createAdapter(),
      policy: {
        defaultEffect: () => 'link',
      },
    });

    engine.beginDrag({
      ctx: { sourceKey: 'col-1' },
      geometry: { target: { targetKey: 'col-2', zone: 'inside' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: {},
    });

    expect(engine.getState().visual.effect).toBe('link');
  });

  it('filters disallowed zones to none', () => {
    const engine = createDndEngine({
      adapter: createAdapter(),
      policy: {
        allowedZones: ['before'],
      },
    });

    engine.beginDrag({
      ctx: { sourceKey: 'col-1' },
      geometry: { target: { targetKey: 'col-2', zone: 'inside' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: {},
    });

    expect(engine.getState().visual.over).toEqual({ zone: 'none' });
    expect(engine.getState().visual.effect).toBeUndefined();
  });

  it('uses canDrop as a central guard for visual state and final drop', () => {
    const canDrop = vi.fn(() => false);
    const engine = createDndEngine({
      adapter: createAdapter(),
      policy: { canDrop },
    });

    engine.beginDrag({
      ctx: { sourceKey: 'col-1' },
      geometry: { target: { targetKey: 'col-2', zone: 'after' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: {},
    });

    expect(canDrop).toHaveBeenCalledTimes(1);
    expect(engine.getState().visual.over).toEqual({ zone: 'none' });
    expect(engine.endDrag({
      geometry: { target: { targetKey: 'col-2', zone: 'after' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: {},
    })).toBeNull();
    expect(engine.getState().phase).toBe('idle');
  });

  it('returns the resolved intent on endDrag and resets to idle', () => {
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    engine.beginDrag({
      ctx: { sourceKey: 'col-1' },
      geometry: { target: { targetKey: 'col-2', zone: 'before' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: {},
    });

    const intent = engine.endDrag({
      geometry: { target: { targetKey: 'col-2', zone: 'before' } },
      pointerClientX: 5,
      pointerClientY: 5,
      mods: { ctrl: true },
    });

    expect(intent).toEqual({
      kind: 'drop',
      zone: 'before',
      effect: 'copy',
      sourceKey: 'col-1',
    });
    expect(engine.getState()).toEqual({
      phase: 'idle',
      visual: { isDragging: false },
    });
  });

  it('cancels the current drag session', () => {
    const engine = createDndEngine({
      adapter: createAdapter(),
    });

    engine.beginDrag({
      ctx: { sourceKey: 'col-1' },
      geometry: { target: { targetKey: 'col-2', zone: 'before' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: {},
    });

    engine.cancelDrag();

    expect(engine.getState()).toEqual({
      phase: 'idle',
      visual: { isDragging: false },
    });
    expect(engine.endDrag({
      geometry: { target: { targetKey: 'col-2', zone: 'before' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: {},
    })).toBeNull();
  });

  it('does nothing when policy.enabled is false', () => {
    const engine = createDndEngine({
      adapter: createAdapter(),
      policy: { enabled: false },
    });

    engine.beginDrag({
      ctx: { sourceKey: 'col-1' },
      geometry: { target: { targetKey: 'col-2', zone: 'before' } },
      pointerClientX: 0,
      pointerClientY: 0,
      mods: {},
    });

    expect(engine.getState()).toEqual({
      phase: 'idle',
      visual: { isDragging: false },
    });
  });
});
