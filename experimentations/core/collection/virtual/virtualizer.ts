import type { VirtualLayoutState } from './types';
import { indexAt, offsetTop } from './layout.engine';
import { OVERSCAN_DEFAULT } from './constants';

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetTop: number;
}

export function computeVirtualWindow(
  itemCount: number,
  scrollTop: number,
  containerHeight: number,
  layoutState: VirtualLayoutState,
  overscan: number = OVERSCAN_DEFAULT
): VirtualWindow {
  if (itemCount === 0) {
    return {
      startIndex: 0,
      endIndex: -1,
      totalHeight: layoutState.totalHeight,
      offsetTop: 0,
    };
  }

  const rawStart = indexAt(layoutState, scrollTop);
  const rawEnd = indexAt(layoutState, scrollTop + containerHeight);

  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(itemCount - 1, rawEnd + overscan);

  return {
    startIndex,
    endIndex,
    totalHeight: layoutState.totalHeight,
    offsetTop: offsetTop(layoutState, startIndex),
  };
}

