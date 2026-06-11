import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MENU_EXTENDED_ITEM_HEIGHT } from '@/core/collection/menu/constants';
import type { JSXDescriptor } from '@/core/collection/shared/kind';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { MenuItemDefinition } from '@/core/collection/menu/types';
import { createInputKind } from '../InputRowKind';

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'input',
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

describe('Menu InputRowKind', () => {
  it('creates a valid input kind with default extended height', () => {
    const kind = createInputKind<string>();
    expect(kind.kind).toBe('input');
    expect(kind.height).toBe(MENU_EXTENDED_ITEM_HEIGHT);
  });

  it('computes JSX descriptor with input metadata', () => {
    const kind = createInputKind<string>();
    const item = {
      id: 'filter',
      kind: 'input',
      label: 'Filter',
      placeholder: 'Type...',
      inputType: 'number',
      draft: '42',
    } satisfies MenuItemDefinition<string>;
    const descriptor = kind.computeDescriptor(item, item.id, createRuntime()) as JSXDescriptor & { value: string; inputType: string };

    expect(descriptor.value).toBe('42');
    expect(descriptor.inputType).toBe('number');
  });

  it('renders input with data-menu-input, type and placeholder', () => {
    const kind = createInputKind<string>();
    const item = {
      id: 'filter',
      kind: 'input',
      label: 'Filter',
      placeholder: 'Type...',
      inputType: 'number',
      draft: '',
    } satisfies MenuItemDefinition<string>;
    const descriptor = kind.computeDescriptor(item, item.id, createRuntime()) as JSXDescriptor;

    render(<>{descriptor.jsx}</>);
    expect(screen.getByText('Filter')).toBeInTheDocument();
    const input = document.querySelector('.menu-kind__input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.dataset.menuInput).toBe('true');
    expect(input?.type).toBe('number');
    expect(input?.placeholder).toBe('Type...');
  });
});




