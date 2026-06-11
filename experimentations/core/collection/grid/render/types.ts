import type { ColumnAlign, ColumnPinned } from '../definition/column.view';

export interface GridRenderColumn {
  id: string;
  headerText: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: ColumnAlign;
  pinned?: ColumnPinned;
}


