import {
  NP6_DND_JSON_V1,
  hitTestRectsX,
  resolveReorder,
} from '@/core/dnd';
import type {
  DndAdapter,
  DndKey,
  DropEffect,
  RectX,
} from '@/core/dnd';

export type HeaderGeometry = {
  orderedColKeys: DndKey[];
  rects: RectX[];
};

export type HeaderDragContext = {
  draggedColKeys: DndKey[];
};

export type HeaderReorderIntent = {
  kind: 'grid.headers.reorder';
  draggedKeys: DndKey[];
  insertIndex: number;
  effect: DropEffect;
};

const GRID_HEADERS_CONTENT_TYPE = 'grid/columns';

export const HeaderDndAdapter: DndAdapter<
  HeaderDragContext,
  HeaderGeometry,
  HeaderReorderIntent
> = {
  getDragPayload: (ctx) => ({
    version: NP6_DND_JSON_V1.version,
    headers: {
      contentType: GRID_HEADERS_CONTENT_TYPE,
      source: 'grid.headers',
    },
    data: {
      items: ctx.draggedColKeys.map((key) => ({
        id: key,
        type: 'grid.column',
      })),
    },
  }),

  hitTest: ({ pointerClientX, geometry }) =>
    hitTestRectsX({
      x: pointerClientX,
      rects: geometry.rects,
    }),

  toIntent: ({ payload, target, effect, geometry }) => {
    if (payload.headers.contentType !== GRID_HEADERS_CONTENT_TYPE) {
      return null;
    }

    const draggedKeys = payload.data.items.map((item) => item.id);
    const reorder = resolveReorder({
      draggedKeys,
      targetKey: target.targetKey,
      zone: target.zone,
      orderedKeys: geometry.orderedColKeys,
    });

    if (!reorder) {
      return null;
    }

    return {
      kind: 'grid.headers.reorder',
      draggedKeys,
      insertIndex: reorder.insertIndex,
      effect,
    };
  },
};


