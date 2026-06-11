import { describe, expect, it } from 'vitest';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import { adaptGridToCollectionConfig } from '../adapter';
import { defineColumn } from '../definition/column';
import { defineGrid } from '../definition/facade';

interface RowItem {
  id: string;
  parentId?: string | null;
  label: string;
  type?: string;
}

describe('adaptGridToCollectionConfig', () => {
  it('maps base grid config to list config', () => {
    const gridConfig = defineGrid<RowItem>({
      getRowId: (row) => row.id,
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          getValue: (row) => row.label,
        }),
      ],
    });

    const listConfig = adaptGridToCollectionConfig(gridConfig);
    expect(listConfig.getItemId({ id: 'r1', label: 'A' })).toBe('r1');
    expect(listConfig.getItemKind?.({ id: 'r1', label: 'A' })).toBe('cellular');
    expect(listConfig.kindMap.cellular).toBeDefined();
    expect(listConfig.kindMap.separator).toBeDefined();
  });

  it('preserves hierarchy mapping', () => {
    const listConfig = adaptGridToCollectionConfig(defineGrid<RowItem>({
      getRowId: (row) => row.id,
      hierarchy: {
        getId: (row) => row.id,
        getParentId: (row) => row.parentId ?? null,
      },
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          getValue: (row) => row.label,
        }),
      ],
    }));

    expect(listConfig.hierarchy?.getId({ id: 'r1', label: 'A' })).toBe('r1');
    expect(listConfig.hierarchy?.getParentId({ id: 'r2', parentId: 'r1', label: 'B' })).toBe('r1');
  });

  it('supports multiple kinds via getRowKind', () => {
    const listConfig = adaptGridToCollectionConfig(defineGrid<RowItem>({
      getRowId: (row) => row.id,
      getRowKind: (row) => row.type ?? 'cellular',
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          getValue: (row) => row.label,
        }),
      ],
    }));

    expect(listConfig.getItemKind?.({ id: 'x', label: 'X', type: 'custom' })).toBe('custom');
    expect(listConfig.kindMap.cellular).toBeDefined();
  });

  it('uses provided kindMap when passed to adapter', () => {
    const gridConfig = defineGrid<RowItem>({
      getRowId: (row) => row.id,
      columns: [
        defineColumn<RowItem>({
          id: 'label',
          header: 'Label',
          getValue: (row) => row.label,
        }),
      ],
    });

    const customCellular: AnyRowKindDefinition<RowItem, string> = {
      kind: 'cellular',
      height: 40,
      computeDescriptor() {
        return { className: 'custom-cellular' };
      },
      create() {
        return {};
      },
      update() {},
    };

    const listConfig = adaptGridToCollectionConfig(gridConfig, {
      cellular: customCellular,
      default: customCellular,
    });

    expect(listConfig.kindMap.cellular).toBe(customCellular);
    expect(listConfig.kindMap.default).toBe(customCellular);
    expect(listConfig.kindMap.separator).toBeDefined();
  });
});


