import { describe, expect, it } from 'vitest';
import type { AnyRowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemDescriptor } from '@/core/collection/shared/kind';
import { adaptMenuToCollectionConfig, getVisibleMenuItems } from '../adapter';
import type { MenuDefinition, MenuItemDefinition } from '../types';

const definition: MenuDefinition<string> = {
  key: 'root',
  items: [
    { id: 'open', kind: 'action', actionId: 'open', label: 'Open' },
    { id: 'checked', kind: 'checkbox', label: 'Checked' },
    { id: 'sep', kind: 'separator' },
    { id: 'input', kind: 'input', label: 'Filter', placeholder: 'Type...', draft: 'abc' },
    {
      id: 'status',
      kind: 'enum',
      label: 'Status',
      values: ['open', 'closed'],
      selectedValues: ['open'],
    },
    { id: 'hidden', kind: 'action', actionId: 'hidden', label: 'Hidden', visible: false },
  ],
};

describe('adaptMenuToCollectionConfig', () => {
  it('maps menu definition kinds to list config kinds', () => {
    const listConfig = adaptMenuToCollectionConfig(definition);

    const first = definition.items[0]!;
    const checkbox = definition.items[1]!;
    const separator = definition.items[2]!;
    const input = definition.items[3]!;
    const enumItem = definition.items[4]!;

    expect(listConfig.getItemId(first)).toBe('open');
    expect(listConfig.getItemKind?.(first)).toBe('action');
    expect(listConfig.getItemKind?.(checkbox)).toBe('checkbox');
    expect(listConfig.getItemKind?.(separator)).toBe('separator');
    expect(listConfig.getItemKind?.(input)).toBe('input');
    expect(listConfig.getItemKind?.(enumItem)).toBe('enum');

    expect(listConfig.kindMap.action).toBeDefined();
    expect(listConfig.kindMap.checkbox).toBeDefined();
    expect(listConfig.kindMap.input).toBeDefined();
    expect(listConfig.kindMap.enum).toBeDefined();
    expect(listConfig.kindMap.separator).toBeDefined();
    expect(listConfig.kindMap.default).toBeDefined();
  });

  it('filters out invisible items at level mapping time', () => {
    const visibleItems = getVisibleMenuItems(definition);

    expect(visibleItems.map((item) => item.id)).toEqual([
      'open',
      'checked',
      'sep',
      'input',
      'status',
    ]);
  });

  it('accepts kindMap overrides from options', () => {
    const customActionKind: AnyRowKindDefinition<MenuItemDefinition<string>, string> = {
      kind: 'action',
      height: 123,
      computeDescriptor: () => ({ label: 'custom' } as ItemDescriptor),
      create: () => ({}),
      update: () => {},
    };

    const listConfig = adaptMenuToCollectionConfig(definition, {
      kindMap: { action: customActionKind },
    });

    expect(listConfig.kindMap.action).toBe(customActionKind);
  });

  it('uses focus-only capabilities (no row selection)', () => {
    const listConfig = adaptMenuToCollectionConfig(definition);

    expect(listConfig.capabilities).toEqual({
      selection: 'none',
      check: true,
      expand: false,
    });
  });
});



