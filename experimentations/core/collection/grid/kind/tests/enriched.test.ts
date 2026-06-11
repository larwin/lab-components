import { describe, expect, it } from 'vitest';
import { computeDescriptorWithInheritance, updateWithInheritance } from '@/core/collection/shared/kind/inheritance';
import { FLAT_HIERARCHY } from '@/core/collection/shared/hierarchy';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import { RowKindCellularDefinition } from '../cellular';
import { RowKindEnrichedDefinition } from '../enriched';
import type { EnrichedDescriptor } from '../enriched';

interface RowItem {
  id: string;
  name: string;
  score: number;
}

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'enriched',
    isFocused: false,
    isSelected: false,
    isChecked: false,
    isDisabled: false,
    isExpanded: false,
    isExpandable: false,
    isVisible: true,
    hierarchy: FLAT_HIERARCHY,
    ...overrides,
  };
}

describe('RowKindEnrichedDefinition', () => {
  it('extends cellular descriptor with a detail line', () => {
    const cellular = new RowKindCellularDefinition<RowItem, string, ItemRuntime>({
      height: 44,
      cells: [
        {
          columnId: 'name',
          getValue: (row) => row.name,
        },
      ],
    });

    const enriched = new RowKindEnrichedDefinition<RowItem, string, ItemRuntime>({
      height: 44,
      cells: [
        {
          columnId: 'name',
          getValue: (row) => row.name,
        },
      ],
      getDetail: (row) => `Score: ${row.score}`,
    });

    const kindMap: Record<string, AnyRowKindDefinition<RowItem, string>> = {
      default: enriched,
      cellular,
      enriched,
    };

    const descriptor = computeDescriptorWithInheritance(
      kindMap,
      'enriched',
      { id: 'r1', name: 'Alpha', score: 9 },
      'r1',
      createRuntime({ isFocused: true })
    ) as EnrichedDescriptor;

    expect(descriptor.cells).toHaveLength(1);
    expect(descriptor.cells[0]?.displayValue).toBe('Alpha');
    expect(descriptor.detail).toBe('Score: 9');
    expect(descriptor.className).toContain('grid-row--enriched');
    expect(descriptor.className).toContain('is-focused');
  });

  it('delegates update to cellular base then renders detail', () => {
    const cells = [
      {
        columnId: 'name',
        getValue: (row: RowItem) => row.name,
        getDisplay: (row: RowItem) => row.name.toUpperCase(),
      },
    ];

    const cellular = new RowKindCellularDefinition<RowItem, string, ItemRuntime>({
      height: 44,
      cells,
    });

    const enriched = new RowKindEnrichedDefinition<RowItem, string, ItemRuntime>({
      height: 44,
      cells,
      getDetail: (row) => `Detail: ${row.score}`,
    });

    const kindMap: Record<string, AnyRowKindDefinition<RowItem, string>> = {
      default: enriched,
      cellular,
      enriched,
    };

    const descriptor = computeDescriptorWithInheritance(
      kindMap,
      'enriched',
      { id: 'r2', name: 'Beta', score: 7 },
      'r2',
      createRuntime({ isSelected: true })
    ) as EnrichedDescriptor;

    const host = document.createElement('div');
    const refs = enriched.create(host);
    updateWithInheritance(kindMap, 'enriched', refs, descriptor);

    expect(refs.valueEls[0]?.textContent).toBe('BETA');
    expect(refs.contentEl.className).toContain('is-selected');
    expect(refs.detailEl.textContent).toBe('Detail: 7');
  });
});



