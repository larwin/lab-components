import { describe, expect, it } from 'vitest';
import { FLAT_HIERARCHY } from '../../hierarchy';
import type { ItemId, ItemRuntime, PrimitiveValue } from '../runtime';

describe('runtime types', () => {
  it('accepts ItemId and PrimitiveValue values', () => {
    const itemIds: ItemId[] = ['a', 1];
    const values: PrimitiveValue[] = ['text', 42, true, null, undefined];

    expect(itemIds).toEqual(['a', 1]);
    expect(values).toHaveLength(5);
  });

  it('accepts ItemRuntime shape', () => {
    const runtime: ItemRuntime = {
      kind: 'text',
      isFocused: false,
      isSelected: true,
      isChecked: false,
      isDisabled: false,
      isExpanded: false,
      isExpandable: false,
      isVisible: true,
      hierarchy: FLAT_HIERARCHY,
    };

    expect(runtime.kind).toBe('text');
    expect(runtime.hierarchy).toBe(FLAT_HIERARCHY);
  });
});
