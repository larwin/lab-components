import type { ItemHeightPolicy, VirtualLayoutState } from './types';

export function computeLayoutState(
  itemKinds: string[],
  policy: ItemHeightPolicy,
  itemCountOverride?: number
): VirtualLayoutState {
  const itemCount = itemCountOverride ?? itemKinds.length;

  if (policy.kind === 'fixed') {
    return {
      uniformHeight: policy.itemHeight,
      heightsByIndex: [],
      prefixSums: [0],
      totalHeight: itemCount * policy.itemHeight,
    };
  }

  const heightsByIndex = new Array<number>(itemCount);

  for (let index = 0; index < itemCount; index++) {
    const kind = itemKinds[index];
    heightsByIndex[index] = policy.heights[kind] ?? policy.defaultHeight;
  }

  const prefixSums = new Array<number>(itemCount + 1);
  prefixSums[0] = 0;

  for (let index = 0; index < itemCount; index++) {
    prefixSums[index + 1] = prefixSums[index] + heightsByIndex[index];
  }

  return {
    heightsByIndex,
    prefixSums,
    totalHeight: prefixSums[itemCount],
  };
}

export function offsetTop(layoutState: VirtualLayoutState, index: number): number {
  if (layoutState.uniformHeight != null) {
    return index * layoutState.uniformHeight;
  }

  return layoutState.prefixSums[index];
}

export function indexAt(layoutState: VirtualLayoutState, scrollTop: number): number {
  if (layoutState.uniformHeight != null) {
    if (layoutState.totalHeight <= 0) return 0;

    const itemCount = Math.ceil(layoutState.totalHeight / layoutState.uniformHeight);
    const clamped = Math.max(0, Math.min(scrollTop, layoutState.totalHeight));
    return Math.min(itemCount - 1, Math.floor(clamped / layoutState.uniformHeight));
  }

  const { prefixSums, heightsByIndex, totalHeight } = layoutState;
  const itemCount = heightsByIndex.length;

  if (itemCount === 0) return 0;

  const clamped = Math.max(0, Math.min(scrollTop, totalHeight));

  let low = 0;
  let high = itemCount - 1;

  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (prefixSums[mid] <= clamped) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

