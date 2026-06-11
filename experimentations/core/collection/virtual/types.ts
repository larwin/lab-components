export type ItemHeightPolicy =
  | { kind: 'fixed'; itemHeight: number; poolItemHeight?: number }
  | { kind: 'byKind'; heights: Record<string, number>; defaultHeight: number; poolItemHeight?: number };

export interface VirtualLayoutState {
  uniformHeight?: number;
  heightsByIndex: number[];
  prefixSums: number[]; // length = n+1; prefixSums[i] = top offset of item i
  totalHeight: number;
}

