import type { DndKey, DropZone } from './types';

export function resolveReorder(args: {
  draggedKeys: DndKey[];
  targetKey?: DndKey;
  zone: DropZone;
  orderedKeys: DndKey[];
}): { insertIndex: number } | null {
  const { draggedKeys, targetKey, zone, orderedKeys } = args;

  if (draggedKeys.length === 0) return null;
  if (zone !== 'before' && zone !== 'after') return null;
  if (!targetKey) return null;

  const draggedSet = new Set(draggedKeys);
  let draggedKeyCount = 0;
  for (const key of orderedKeys) {
    if (draggedSet.has(key)) {
      draggedKeyCount += 1;
    }
  }

  if (draggedKeyCount === 0) return null;

  const targetOriginalIndex = orderedKeys.indexOf(targetKey);
  if (targetOriginalIndex < 0) return null;

  const insertionPoint =
    zone === 'before' ? targetOriginalIndex : targetOriginalIndex + 1;

  let removedBeforeInsertion = 0;
  for (let index = 0; index < insertionPoint; index += 1) {
    if (draggedSet.has(orderedKeys[index] as DndKey)) {
      removedBeforeInsertion += 1;
    }
  }

  return {
    insertIndex: insertionPoint - removedBeforeInsertion,
  };
}
