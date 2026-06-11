import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LIST_DEFAULT_ITEM_HEIGHT } from '@/core/collection/list/constants';
import type { JSXDescriptor } from '@/core/collection/list/kind/jsx-descriptor';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { createTextKind } from '../TextRowKind';

interface Item {
  id: string;
  name: string;
  hint?: string;
}

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'text',
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

describe('TextRowKind', () => {
  it('creates a valid text kind with default height', () => {
    const kind = createTextKind<Item>({
      getLabel: (item) => item.name,
    });

    expect(kind.kind).toBe('text');
    expect(kind.height).toBe(LIST_DEFAULT_ITEM_HEIGHT);
  });

  it('computes label and sublabel descriptor', () => {
    const kind = createTextKind<Item>({
      getLabel: (item) => item.name,
      getSublabel: (item) => item.hint,
    });
    const descriptor = kind.computeDescriptor(
      { id: '1', name: 'Alpha', hint: 'First' },
      '1',
      createRuntime(),
    ) as JSXDescriptor & { label: string; sublabel?: string };

    expect(descriptor.label).toBe('Alpha');
    expect(descriptor.sublabel).toBe('First');
    expect(descriptor.jsx).toBeTruthy();
  });

  it('creates jsxHostEl and update is a no-op', () => {
    const kind = createTextKind<Item>({
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

  it('renders JSX label and sublabel', () => {
    const kind = createTextKind<Item>({
      getLabel: (item) => item.name,
      getSublabel: (item) => item.hint,
    });
    const descriptor = kind.computeDescriptor(
      { id: '3', name: 'Gamma', hint: 'Third' },
      '3',
      createRuntime(),
    ) as JSXDescriptor;

    render(<>{descriptor.jsx}</>);
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });
});




