import { describe, it, expect } from 'vitest';
import { computeLayoutState, offsetTop, indexAt } from '../layout.engine';

describe('computeLayoutState', () => {
  it('applies fixed height to all items', () => {
    const state = computeLayoutState(['text', 'separator', 'text'], {
      kind: 'fixed',
      itemHeight: 40,
    });

    expect(state.uniformHeight).toBe(40);
    expect(state.heightsByIndex).toEqual([]);
    expect(state.prefixSums).toEqual([0]);
    expect(state.totalHeight).toBe(120);
  });

  it('applies byKind heights with default fallback', () => {
    const state = computeLayoutState(['text', 'separator', 'custom', 'separator'], {
      kind: 'byKind',
      heights: { text: 32, separator: 8 },
      defaultHeight: 36,
    });

    expect(state.heightsByIndex).toEqual([32, 8, 36, 8]);
    expect(state.totalHeight).toBe(84);
  });

  it('builds correct prefix sums', () => {
    const state = computeLayoutState(['a', 'b', 'c'], {
      kind: 'byKind',
      heights: { a: 10, b: 20, c: 30 },
      defaultHeight: 1,
    });

    expect(state.prefixSums).toEqual([0, 10, 30, 60]);
  });

  it('supports zero items', () => {
    const state = computeLayoutState([], { kind: 'fixed', itemHeight: 36 });

    expect(state.heightsByIndex).toEqual([]);
    expect(state.prefixSums).toEqual([0]);
    expect(state.totalHeight).toBe(0);
  });

  it('supports one item', () => {
    const state = computeLayoutState(['text'], { kind: 'fixed', itemHeight: 44 });

    expect(state.heightsByIndex).toEqual([]);
    expect(state.prefixSums).toEqual([0]);
    expect(state.totalHeight).toBe(44);
  });

  it('uses uniform fixed layout without per-item arrays', () => {
    const state = computeLayoutState([], { kind: 'fixed', itemHeight: 36 }, 100_000);

    expect(state.uniformHeight).toBe(36);
    expect(state.heightsByIndex.length).toBe(0);
    expect(state.prefixSums).toEqual([0]);
    expect(offsetTop(state, 1234)).toBe(44_424);
    expect(indexAt(state, 44_424)).toBe(1234);
  });
});

describe('offsetTop and indexAt', () => {
  it('returns expected top offsets', () => {
    const state = computeLayoutState(['a', 'b', 'c'], {
      kind: 'byKind',
      heights: { a: 10, b: 20, c: 30 },
      defaultHeight: 1,
    });

    expect(offsetTop(state, 0)).toBe(0);
    expect(offsetTop(state, 1)).toBe(10);
    expect(offsetTop(state, 2)).toBe(30);
  });

  it('resolves item index from scrollTop using binary search', () => {
    const state = computeLayoutState(['a', 'b', 'c', 'd'], {
      kind: 'byKind',
      heights: { a: 10, b: 20, c: 30, d: 40 },
      defaultHeight: 1,
    });
    // prefix: [0, 10, 30, 60, 100]

    expect(indexAt(state, 0)).toBe(0);
    expect(indexAt(state, 9)).toBe(0);
    expect(indexAt(state, 10)).toBe(1);
    expect(indexAt(state, 29)).toBe(1);
    expect(indexAt(state, 30)).toBe(2);
    expect(indexAt(state, 59)).toBe(2);
    expect(indexAt(state, 60)).toBe(3);
    expect(indexAt(state, 1000)).toBe(3);
    expect(indexAt(state, -100)).toBe(0);
  });

  it('returns 0 for empty layout', () => {
    const state = computeLayoutState([], { kind: 'fixed', itemHeight: 20 });

    expect(indexAt(state, 0)).toBe(0);
    expect(indexAt(state, 100)).toBe(0);
  });
});
