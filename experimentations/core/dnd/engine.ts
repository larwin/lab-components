import type {
  CreateDndEngineArgs,
  DndEngine,
  DndEngineState,
  DndPolicy,
  DragPayload,
  DropEffect,
  DropTarget,
  ModifierKeys,
} from './types';

const DEFAULT_ALLOWED_ZONES: DropTarget['zone'][] = ['before', 'after', 'inside'];

function defaultEffect(mods: ModifierKeys): DropEffect {
  return mods.ctrl || mods.meta ? 'copy' : 'move';
}

function createIdleState(): DndEngineState {
  return {
    phase: 'idle',
    visual: { isDragging: false },
  };
}

function normalizeTarget<TContext>(
  payload: DragPayload,
  target: DropTarget,
  effect: DropEffect,
  mods: ModifierKeys,
  policy: DndPolicy,
): DropTarget {
  if (target.zone === 'none') return target;

  const allowedZones = policy.allowedZones ?? DEFAULT_ALLOWED_ZONES;
  if (!allowedZones.includes(target.zone)) {
    return { zone: 'none' };
  }

  if (policy.canDrop && !policy.canDrop({ payload, target, effect, mods })) {
    return { zone: 'none' };
  }

  return target;
}

export function createDndEngine<TContext, TGeometry, TIntent>({
  adapter,
  policy = {},
}: CreateDndEngineArgs<TContext, TGeometry, TIntent>): DndEngine<TContext, TGeometry, TIntent> {
  let state: DndEngineState = createIdleState();
  let session: { ctx: TContext; payload: DragPayload } | null = null;

  function resolveEffect(mods: ModifierKeys): DropEffect {
    return (policy.defaultEffect ?? defaultEffect)(mods);
  }

  function resolveTarget(
    payload: DragPayload,
    geometry: TGeometry,
    pointerClientX: number,
    pointerClientY: number,
    mods: ModifierKeys,
  ): { target: DropTarget; effect: DropEffect | undefined } {
    const effect = resolveEffect(mods);
    const rawTarget = adapter.hitTest({
      geometry,
      pointerClientX,
      pointerClientY,
    });
    const target = normalizeTarget(payload, rawTarget, effect, mods, policy);

    return {
      target,
      effect: target.zone === 'none' ? undefined : effect,
    };
  }

  return {
    getState: () => state,

    beginDrag: ({ ctx, geometry, pointerClientX, pointerClientY, mods }) => {
      if (policy.enabled === false) return;

      const payload = adapter.getDragPayload(ctx);
      session = { ctx, payload };

      const { target, effect } = resolveTarget(
        payload,
        geometry,
        pointerClientX,
        pointerClientY,
        mods,
      );

      state = {
        phase: 'dragging',
        visual: {
          isDragging: true,
          payload,
          over: target,
          effect,
        },
      };
    },

    updatePointer: ({ geometry, pointerClientX, pointerClientY, mods }) => {
      if (state.phase !== 'dragging' || !session) return;

      const { target, effect } = resolveTarget(
        session.payload,
        geometry,
        pointerClientX,
        pointerClientY,
        mods,
      );

      state = {
        phase: 'dragging',
        visual: {
          isDragging: true,
          payload: session.payload,
          over: target,
          effect,
        },
      };
    },

    endDrag: ({ geometry, pointerClientX, pointerClientY, mods }) => {
      if (state.phase !== 'dragging' || !session) return null;

      const { ctx, payload } = session;
      const { target, effect } = resolveTarget(
        payload,
        geometry,
        pointerClientX,
        pointerClientY,
        mods,
      );

      session = null;
      state = createIdleState();

      if (target.zone === 'none' || !effect) {
        return null;
      }

      return adapter.toIntent({
        payload,
        target,
        effect,
        mods,
        geometry,
        ctx,
      });
    },

    cancelDrag: () => {
      session = null;
      state = createIdleState();
    },
  };
}
