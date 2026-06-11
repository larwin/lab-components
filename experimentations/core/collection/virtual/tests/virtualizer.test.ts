import { describe, it, expect } from 'vitest';
import { computeLayoutState } from '../layout.engine';
import { computeVirtualWindow } from '../virtualizer';

describe('computeVirtualWindow', () => {
  it('returns empty window for 0 items', () => {
    const layout = computeLayoutState([], { kind: 'fixed', itemHeight: 36 });
    const window = computeVirtualWindow(0, 0, 200, layout, 3);

    expect(window).toEqual({
      startIndex: 0,
      endIndex: -1,
      totalHeight: 0,
      offsetTop: 0,
    });
  });

  it('keeps mandatory virtualization for 1 item', () => {
    const layout = computeLayoutState(['text'], { kind: 'fixed', itemHeight: 36 });
    const window = computeVirtualWindow(1, 0, 200, layout, 3);

    expect(window.startIndex).toBe(0);
    expect(window.endIndex).toBe(0);
    expect(window.totalHeight).toBe(36);
    expect(window.offsetTop).toBe(0);
  });

  it('computes a stable window on larger lists', () => {
    const kinds = new Array(100).fill('text');
    const layout = computeLayoutState(kinds, { kind: 'fixed', itemHeight: 40 });
    const window = computeVirtualWindow(100, 400, 200, layout, 0);

    expect(window.startIndex).toBe(10);
    expect(window.endIndex).toBe(15);
    expect(window.offsetTop).toBe(400);
    expect(window.totalHeight).toBe(4000);
  });

  it('applies overscan and clamps to boundaries', () => {
    const kinds = new Array(20).fill('text');
    const layout = computeLayoutState(kinds, { kind: 'fixed', itemHeight: 30 });
    const window = computeVirtualWindow(20, 300, 120, layout, 2);

    expect(window.startIndex).toBe(8);
    expect(window.endIndex).toBe(16);
    expect(window.offsetTop).toBe(240);
  });

  it('handles variable heights from kinds', () => {
    const layout = computeLayoutState(['a', 'b', 'a', 'c', 'a'], {
      kind: 'byKind',
      heights: { a: 20, b: 50, c: 80 },
      defaultHeight: 20,
    });
    // prefix: [0, 20, 70, 90, 170, 190]
    const window = computeVirtualWindow(5, 70, 80, layout, 0);

    expect(window.startIndex).toBe(2);
    expect(window.endIndex).toBe(3);
    expect(window.offsetTop).toBe(70);
    expect(window.totalHeight).toBe(190);
  });

  it('handles scrollTop at start, middle and end', () => {
    const kinds = new Array(10).fill('text');
    const layout = computeLayoutState(kinds, { kind: 'fixed', itemHeight: 25 });

    const atStart = computeVirtualWindow(10, 0, 50, layout, 0);
    const atMiddle = computeVirtualWindow(10, 100, 50, layout, 0);
    const atEnd = computeVirtualWindow(10, 1000, 50, layout, 0);

    expect(atStart).toMatchObject({ startIndex: 0, endIndex: 2 });
    expect(atMiddle).toMatchObject({ startIndex: 4, endIndex: 6 });
    expect(atEnd).toMatchObject({ startIndex: 9, endIndex: 9 });
  });
});
