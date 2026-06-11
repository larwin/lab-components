import type { DndKey, DropTarget } from './types';

export type RectX = {
  key: DndKey;
  left: number;
  right: number;
};

export type RectY = {
  key: DndKey;
  top: number;
  bottom: number;
};

export function hitTestRectsX(args: { x: number; rects: RectX[] }): DropTarget {
  const { x, rects } = args;
  const firstRect = rects[0];
  const lastRect = rects[rects.length - 1];

  if (firstRect && x < firstRect.left) {
    return {
      targetKey: firstRect.key,
      zone: 'before',
    };
  }

  if (lastRect && x > lastRect.right) {
    return {
      targetKey: lastRect.key,
      zone: 'after',
    };
  }

  for (const rect of rects) {
    if (x < rect.left || x > rect.right) {
      continue;
    }

    const mid = rect.left + (rect.right - rect.left) / 2;
    return {
      targetKey: rect.key,
      zone: x < mid ? 'before' : 'after',
    };
  }

  return { zone: 'none' };
}

export function hitTestRectsY(args: { y: number; rects: RectY[] }): DropTarget {
  const { y, rects } = args;

  for (const rect of rects) {
    if (y < rect.top || y > rect.bottom) {
      continue;
    }

    const mid = rect.top + (rect.bottom - rect.top) / 2;
    return {
      targetKey: rect.key,
      zone: y < mid ? 'before' : 'after',
    };
  }

  return { zone: 'none' };
}
