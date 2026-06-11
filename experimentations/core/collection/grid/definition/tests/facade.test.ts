import { describe, expect, it } from 'vitest';
import { FLAT_HIERARCHY } from '@/core/collection/shared/hierarchy';
import { createRowKindTextDefinition } from '@/core/collection/shared/kind/text';
import { RowKindCellularDefinition } from '../../kind/cellular';
import { defineColumn } from '../column';
import { defineGrid, toGridConfig } from '../facade';

interface RowItem {
  id: string;
  label: string;
  type?: string;
}

describe('defineGrid', () => {
  it('injects defaults and builds cellular kind map automatically', () => {
    const config = defineGrid<RowItem>({
      getRowId: (row) => row.id,
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          getValue: (row) => row.label,
        }),
      ],
    });

    expect(config.rowHeight).toBe(40);
    expect(config.defaultKind).toBe('cellular');
    expect(config.getRowKind?.({ id: 'a', label: 'A' })).toBe('cellular');
    expect(config.columnCoreDefs).toHaveLength(1);
    expect(config.columnViewDefs).toHaveLength(1);
    expect(config.cellKinds).toHaveLength(1);
    expect(config.kindMap.cellular).toBeDefined();
    expect(config.kindMap.default).toBe(config.kindMap.cellular);
  });

  it('preserves custom row kind mapping and getRowKind', () => {
    const textKind = createRowKindTextDefinition<RowItem>({
      height: 28,
      getLabel: (row) => row.label,
    });

    const config = defineGrid<RowItem>({
      getRowId: (row) => row.id,
      getRowKind: (row) => row.type ?? 'cellular',
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          getValue: (row) => row.label,
        }),
      ],
      kindMap: {
        text: textKind as never,
      },
    });

    expect(config.getRowKind?.({ id: 'x', label: 'X', type: 'text' })).toBe('text');
    expect(config.kindMap.text).toBe(textKind);
    expect(config.kindMap.cellular).toBeDefined();
  });

  it('returns already normalized configs unchanged via toGridConfig', () => {
    const config = defineGrid<RowItem>({
      getRowId: (row) => row.id,
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          getValue: (row) => row.label,
        }),
      ],
    });

    expect(toGridConfig(config)).toBe(config);
  });

  it('keeps reconstructed cellular kind priority over provided kindMap.cellular', () => {
    const staleCellular = new RowKindCellularDefinition<RowItem>({
      cells: [],
      height: 12,
    });

    const config = defineGrid<RowItem>({
      getRowId: (row) => row.id,
      rowHeight: 40,
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          getValue: (row) => row.label,
        }),
      ],
      kindMap: {
        cellular: staleCellular as never,
      },
    });

    expect(config.kindMap.cellular).not.toBe(staleCellular);
    expect(config.kindMap.cellular).toBeInstanceOf(RowKindCellularDefinition);
    expect((config.kindMap.cellular as RowKindCellularDefinition<RowItem>).height).toBe(40);
    expect(config.kindMap.default).toBe(config.kindMap.cellular);
  });

  it('rebuilds cellular cells from declared columns, not external kindMap.cellular', () => {
    const staleCellular = new RowKindCellularDefinition<RowItem>({
      cells: [],
      height: 12,
    });

    const config = defineGrid<RowItem>({
      getRowId: (row) => row.id,
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          width: 120,
          getValue: (row) => row.label,
        }),
        defineColumn<RowItem>({
          id: 'id',
          header: 'Id',
          width: 260,
          getValue: (row) => row.id,
        }),
      ],
      kindMap: {
        cellular: staleCellular as never,
      },
    });

    const cellular = config.kindMap.cellular as RowKindCellularDefinition<RowItem>;
    const descriptor = cellular.computeDescriptor(
      { id: 'r1', label: 'Row 1' },
      'r1',
      {
        kind: 'cellular',
        isFocused: false,
        isSelected: false,
        isChecked: false,
        isDisabled: false,
        isExpanded: false,
        isExpandable: false,
        isVisible: true,
        hierarchy: FLAT_HIERARCHY,
      },
    );

    expect(cellular).not.toBe(staleCellular);
    expect(descriptor.cells).toHaveLength(2);
    expect(descriptor.cells[0]).toMatchObject({ columnId: 'label' });
    expect(descriptor.cells[1]).toMatchObject({ columnId: 'id' });
    expect(descriptor.cells[0].style?.width).toBe('120px');
    expect(descriptor.cells[1].style?.width).toBe('260px');
  });
});



