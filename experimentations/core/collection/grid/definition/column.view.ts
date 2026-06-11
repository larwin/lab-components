import type { I18nText, Culture } from '@/core/culture';

export type ColumnAlign = 'left' | 'center' | 'right';
export type ColumnPinned = 'left' | 'right' | false;

export interface ColumnViewDef {
  header: I18nText;
  getDisplay?: (row: unknown, colId: string, culture: Culture) => unknown;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  align?: ColumnAlign;
  pinned?: ColumnPinned;
}


