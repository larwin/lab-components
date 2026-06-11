import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LIST_DEFAULT_ITEM_HEIGHT } from '@/core/collection/list/constants';
import type { JSXDescriptor } from '@/core/collection/list/kind/jsx-descriptor';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { createCheckboxKind } from '../CheckboxRowKind';

interface Item {
  id: string;
  name: string;
}

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

describe('CheckboxRowKind', () => {
  it('creates a valid checkbox kind with default height', () => {
    const kind = createCheckboxKind<Item>({
      getLabel: (item) => item.name,
    });

    expect(kind.kind).toBe('checkbox');
    expect(kind.height).toBe(LIST_DEFAULT_ITEM_HEIGHT);
  });

  it('computes checkbox descriptor from runtime state', () => {
    const kind = createCheckboxKind<Item>({
      getLabel: (item) => item.name,
    });
    const descriptor = kind.computeDescriptor(
      { id: '1', name: 'Alpha' },
      '1',
      createRuntime({ isChecked: true, isDisabled: true }),
    ) as JSXDescriptor & { label: string; isChecked: boolean; isDisabled: boolean };

    expect(descriptor.label).toBe('Alpha');
    expect(descriptor.isChecked).toBe(true);
    expect(descriptor.isDisabled).toBe(true);
    expect(descriptor.jsx).toBeTruthy();
  });

  it('creates jsxHostEl and update is a no-op', () => {
    const kind = createCheckboxKind<Item>({
      getLabel: (item) => item.name,
    });
    const container = document.createElement('div');
    const refs = kind.create(container) as { jsxHostEl?: HTMLDivElement };
    const descriptor = kind.computeDescriptor(
      { id: '2', name: 'Beta' },
      '2',
      createRuntime(),
    );

    expect(refs.jsxHostEl).toBeDefined();
    expect(container.contains(refs.jsxHostEl as HTMLDivElement)).toBe(true);
    expect(() => kind.update(refs as never, descriptor as never)).not.toThrow();
  });

  it('renders checked, disabled and data-list-checkbox attribute', () => {
    const kind = createCheckboxKind<Item>({
      getLabel: (item) => item.name,
    });
    const descriptor = kind.computeDescriptor(
      { id: '3', name: 'Gamma' },
      '3',
      createRuntime({ isChecked: true, isDisabled: true }),
    ) as JSXDescriptor;

    render(<>{descriptor.jsx}</>);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAttribute('data-list-checkbox', 'true');
  });
});




