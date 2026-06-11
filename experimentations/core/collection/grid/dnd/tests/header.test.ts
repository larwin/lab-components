import { describe, expect, it } from 'vitest';
import { HeaderDndAdapter } from '../header';

describe('HeaderDndAdapter', () => {
  it('builds a grid column drag payload', () => {
    expect(
      HeaderDndAdapter.getDragPayload({
        draggedColKeys: ['name', 'role'],
      }),
    ).toEqual({
      version: '1.0',
      headers: {
        contentType: 'grid/columns',
        source: 'grid.headers',
      },
      data: {
        items: [
          { id: 'name', type: 'grid.column' },
          { id: 'role', type: 'grid.column' },
        ],
      },
    });
  });

  it('resolves horizontal hit testing through rect geometry', () => {
    expect(
      HeaderDndAdapter.hitTest({
        pointerClientX: 25,
        pointerClientY: 0,
        geometry: {
          orderedColKeys: ['name', 'role'],
          rects: [
            { key: 'name', left: 0, right: 100 },
            { key: 'role', left: 100, right: 200 },
          ],
        },
      }),
    ).toEqual({
      targetKey: 'name',
      zone: 'before',
    });
  });

  it('keeps the last header droppable when dragging beyond the final rect', () => {
    expect(
      HeaderDndAdapter.hitTest({
        pointerClientX: 260,
        pointerClientY: 0,
        geometry: {
          orderedColKeys: ['name', 'role'],
          rects: [
            { key: 'name', left: 0, right: 100 },
            { key: 'role', left: 100, right: 200 },
          ],
        },
      }),
    ).toEqual({
      targetKey: 'role',
      zone: 'after',
    });
  });

  it('maps a drop to a header reorder intent', () => {
    const payload = HeaderDndAdapter.getDragPayload({
      draggedColKeys: ['name'],
    });

    expect(
      HeaderDndAdapter.toIntent({
        payload,
        target: { targetKey: 'status', zone: 'before' },
        effect: 'move',
        mods: {},
        geometry: {
          orderedColKeys: ['id', 'name', 'status', 'age'],
          rects: [],
        },
        ctx: { draggedColKeys: ['name'] },
      }),
    ).toEqual({
      kind: 'grid.headers.reorder',
      draggedKeys: ['name'],
      insertIndex: 1,
      effect: 'move',
    });
  });

  it('returns null when the payload content type does not match grid headers', () => {
    expect(
      HeaderDndAdapter.toIntent({
        payload: {
          version: '1.0',
          headers: { contentType: 'grid/rows' },
          data: { items: [{ id: 'name', type: 'grid.column' }] },
        },
        target: { targetKey: 'status', zone: 'before' },
        effect: 'move',
        mods: {},
        geometry: {
          orderedColKeys: ['id', 'name', 'status', 'age'],
          rects: [],
        },
        ctx: { draggedColKeys: ['name'] },
      }),
    ).toBeNull();
  });

  it('returns null when reorder cannot be resolved', () => {
    const payload = HeaderDndAdapter.getDragPayload({
      draggedColKeys: ['name'],
    });

    expect(
      HeaderDndAdapter.toIntent({
        payload,
        target: { zone: 'inside', targetKey: 'status' },
        effect: 'move',
        mods: {},
        geometry: {
          orderedColKeys: ['id', 'name', 'status', 'age'],
          rects: [],
        },
        ctx: { draggedColKeys: ['name'] },
      }),
    ).toBeNull();
  });
});


