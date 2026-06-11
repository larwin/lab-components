import { describe, expect, it } from 'vitest';
import { defineColumn } from '../column';

interface RowItem {
  id: string;
  name: string;
  amount: number;
}

describe('defineColumn', () => {
  it('builds core/cell/view definitions from a single column declaration', () => {
    const column = defineColumn<RowItem>({
      id: 'amount',
      header: 'Amount',
      kind: 'number',
      getValue: (row) => row.amount,
      getDisplay: (_row, value) => `${value} EUR`,
      sortable: true,
      filterable: true,
      width: 120,
      align: 'right',
    });

    expect(column.id).toBe('amount');
    expect(column.kind).toBe('number');
    expect(column.header).toEqual({ kind: 'literal', value: 'Amount' });

    const row: RowItem = { id: 'r1', name: 'Alice', amount: 42 };
    expect(column.core.getValue(row, 'amount', undefined as never)).toBe(42);
    expect(column.cell.getValue(row, 'r1', undefined as never, undefined)).toBe(42);
    expect(column.cell.getDisplay?.(row, 'r1', undefined as never, 42, undefined)).toBe('42 EUR');

    const style = column.cell.getStyle?.(row, 'r1', undefined as never, 42, '42 EUR', undefined);
    expect(style).toMatchObject({
      width: '120px',
      flex: '0 0 120px',
      justifyContent: 'flex-end',
      textAlign: 'right',
    });
  });

  it('marks hierarchy columns for cellular indentation/rendering', () => {
    const column = defineColumn<RowItem>({
      id: 'name',
      header: 'Name',
      kind: 'hierarchy',
      getValue: (row) => row.name,
    });

    expect(column.cell.isHierarchyColumn).toBe(true);
  });
});

