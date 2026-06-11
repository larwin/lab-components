import type { DragItem } from './types';

export function hasMixedTypes(items: DragItem[]): boolean {
  if (items.length <= 1) return false;

  const firstType = items[0]?.type;
  return items.some((item) => item.type !== firstType);
}
