import type { I18nText } from '@/core/culture';

export type AvailableActions = {
  row?: string[];
  bulk?: string[];
};

export interface RowActionDef<TItem> {
  id: string;
  label: I18nText;
  icon?: string;
  shortcut?: string;
  isAvailable?: (row: TItem) => boolean;
}

export interface BulkActionDef<TItem> {
  id: string;
  label: I18nText;
  icon?: string;
  isAvailable?: (selectedRows: TItem[]) => boolean;
  minSelection?: number;
}


