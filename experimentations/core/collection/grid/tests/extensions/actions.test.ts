import { describe, expect, it } from 'vitest';
import { i18n } from '@/core/culture';
import { computeGridBulkActions, computeGridRowActions } from '../../extensions/actions';

interface RowItem {
  id: string;
  active: boolean;
}

describe('grid actions extensions', () => {
  it('computes available row actions through v1 controller wrapper', () => {
    const actions = [
      { id: 'edit', label: i18n.literal('Edit') },
      { id: 'delete', label: i18n.literal('Delete'), isAvailable: (row: RowItem) => row.active },
    ];

    expect(computeGridRowActions({ id: 'r1', active: true }, actions)).toEqual(['edit', 'delete']);
    expect(computeGridRowActions({ id: 'r2', active: false }, actions)).toEqual(['edit']);
  });

  it('computes available bulk actions through v1 controller wrapper', () => {
    const actions = [
      { id: 'archive', label: i18n.literal('Archive'), minSelection: 2 },
      {
        id: 'delete',
        label: i18n.literal('Delete'),
        minSelection: 2,
        isAvailable: (rows: RowItem[]) => rows.every((row) => row.active),
      },
    ];

    expect(computeGridBulkActions([{ id: 'r1', active: true }], actions)).toEqual([]);
    expect(computeGridBulkActions([{ id: 'r1', active: true }, { id: 'r2', active: true }], actions)).toEqual([
      'archive',
      'delete',
    ]);
  });
});

