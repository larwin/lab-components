import { describe, expect, it } from 'vitest';
import {
  getPooledItemElementFromEventTarget,
  getVisibleIndexFromEventTarget,
  getVisibleIndexFromPooledItemElement,
} from '../eventTarget';

describe('pool event target helpers', () => {
  it('resolves visible index from nested event targets', () => {
    const pooledItem = document.createElement('div');
    pooledItem.className = 'list-pooled-item';
    pooledItem.dataset.visibleIndex = '3';
    const child = document.createElement('span');
    pooledItem.appendChild(child);

    expect(getVisibleIndexFromEventTarget(child)).toBe(3);
    expect(getPooledItemElementFromEventTarget(child)).toBe(pooledItem);
  });

  it('returns null when visible index is missing or invalid', () => {
    const pooledItem = document.createElement('div');
    pooledItem.className = 'list-pooled-item';
    pooledItem.dataset.visibleIndex = 'x';

    expect(getVisibleIndexFromPooledItemElement(pooledItem)).toBeNull();
    expect(getVisibleIndexFromEventTarget(null)).toBeNull();
    expect(getPooledItemElementFromEventTarget({} as EventTarget)).toBeNull();
  });
});
