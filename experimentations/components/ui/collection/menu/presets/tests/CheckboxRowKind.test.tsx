import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MENU_ITEM_HEIGHT } from '@/core/collection/menu/constants';
import type { JSXDescriptor } from '@/core/collection/shared/kind';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { MenuItemDefinition } from '@/core/collection/menu/types';
import { createCheckboxKind } from '../CheckboxRowKind';

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'checkbox',
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

describe('Menu CheckboxRowKind', () => {
  it('creates a valid checkbox kind with default height', () => {
    const kind = createCheckboxKind<string>();
    expect(kind.kind).toBe('checkbox');
    expect(kind.height).toBe(MENU_ITEM_HEIGHT);
  });

  it('computes JSX descriptor with checked and disabled state', () => {
    const kind = createCheckboxKind<string>();
    const item = {
      id: 'check',
      kind: 'checkbox',
      label: 'Include archived',
    } satisfies MenuItemDefinition<string>;
    const descriptor = kind.computeDescriptor(
      item,
      item.id,
      createRuntime({ isChecked: true, isDisabled: true })
    ) as JSXDescriptor & { isChecked: boolean; isDisabled: boolean; className?: string };

    expect(descriptor.isChecked).toBe(true);
    expect(descriptor.isDisabled).toBe(true);
    expect(descriptor.className).toContain('is-checked');
  });

  it('renders checkbox with required data-list-checkbox attribute', () => {
    const kind = createCheckboxKind<string>();
    const item = {
      id: 'check',
      kind: 'checkbox',
      label: 'Include archived',
    } satisfies MenuItemDefinition<string>;
    const descriptor = kind.computeDescriptor(item, item.id, createRuntime({ isChecked: true })) as JSXDescriptor;

    render(<>{descriptor.jsx}</>);
    expect(screen.getByText('Include archived')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAttribute('data-list-checkbox', 'true');
  });
});




