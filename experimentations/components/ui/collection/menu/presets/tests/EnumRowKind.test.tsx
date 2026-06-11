import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MENU_EXTENDED_ITEM_HEIGHT } from '@/core/collection/menu/constants';
import type { JSXDescriptor } from '@/core/collection/shared/kind';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { MenuItemDefinition } from '@/core/collection/menu/types';
import { createEnumKind } from '../EnumRowKind';

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'enum',
    isFocused: false,
    isSelected: false,
    isChecked: false,
    isDisabled: false,
    isExpanded: false,
    isExpandable: false,
    isVisible: true,
    hierarchy: {
      depth: 0,
      parentId: null,
      childrenIds: [],
      hasChildren: false,
    },
    ...overrides,
  };
}

describe('Menu EnumRowKind', () => {
  it('creates a valid enum kind with default extended height', () => {
    const kind = createEnumKind<string>();
    expect(kind.kind).toBe('enum');
    expect(kind.height).toBe(MENU_EXTENDED_ITEM_HEIGHT);
  });

  it('renders enum buttons with data-menu-enum-value and selected state', () => {
    const kind = createEnumKind<string>();
    const item = {
      id: 'status',
      kind: 'enum',
      label: 'Status',
      values: ['active', 'paused'],
      selectedValues: ['active'],
    } satisfies MenuItemDefinition<string>;
    const descriptor = kind.computeDescriptor(item, item.id, createRuntime()) as JSXDescriptor;

    render(<>{descriptor.jsx}</>);
    expect(screen.getByText('Status')).toBeInTheDocument();
    const active = screen.getByRole('button', { name: 'active' });
    const paused = screen.getByRole('button', { name: 'paused' });
    expect(active).toHaveAttribute('data-menu-enum-value', 'active');
    expect(paused).toHaveAttribute('data-menu-enum-value', 'paused');
    expect(active.className).toContain('is-selected');
    expect(paused.className).not.toContain('is-selected');
  });

  it('renders no enum buttons when values is empty', () => {
    const kind = createEnumKind<string>();
    const item = {
      id: 'status',
      kind: 'enum',
      label: 'Status',
      values: [],
      selectedValues: [],
    } satisfies MenuItemDefinition<string>;
    const descriptor = kind.computeDescriptor(item, item.id, createRuntime()) as JSXDescriptor;

    render(<>{descriptor.jsx}</>);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});




