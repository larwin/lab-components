import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defineCollection } from '@/core/collection/shared/definition/facade';
import type { JSXDescriptor } from '@/core/collection/list/kind/jsx-descriptor';
import type { RowKindDefinition } from '@/core/collection/list/kind/types';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { TestControlledList } from './TestControlledList';

interface Item {
  id: string;
  label: string;
}

interface JSXRefs {
  jsxHostEl: HTMLDivElement;
}

function createJSXKind(onUnmount?: (id: string) => void): RowKindDefinition<
  Item,
  string,
  ItemRuntime,
  JSXDescriptor,
  JSXRefs
> {
  function Probe({ item }: { item: Item }) {
    useEffect(() => {
      return () => onUnmount?.(item.id);
    }, [item.id]);

    return <span data-testid={`jsx-kind-${item.id}`}>{item.label}</span>;
  }

  return {
    kind: 'jsx',
    height: 28,
    computeDescriptor: (item) => ({
      className: 'is-jsx-kind',
      jsx: <Probe item={item} />,
    }),
    create: (container) => {
      const jsxHostEl = document.createElement('div');
      jsxHostEl.className = 'jsx-host';
      container.appendChild(jsxHostEl);
      return { jsxHostEl };
    },
    update: () => {
      // JSX rendering is handled by JSXSlotRenderer.
    },
  };
}

function createDefinition(onUnmount?: (id: string) => void) {
  return defineCollection<Item>({
    getItemId: (item) => item.id,
    getItemKind: () => 'jsx',
    kindMap: {
      jsx: createJSXKind(onUnmount) as any,
    },
  });
}

describe('List JSX kind support', () => {
  it('renders JSX descriptors in pooled slots and updates on rerender', async () => {
    const definition = createDefinition();
    const { rerender } = render(
      <TestControlledList
        items={[{ id: '1', label: 'Alpha' }]}
        definition={definition}
      />
    );

    expect(await screen.findByTestId('jsx-kind-1')).toHaveTextContent('Alpha');

    rerender(
      <TestControlledList
        items={[{ id: '1', label: 'Alpha updated' }]}
        definition={definition}
      />
    );

    expect(await screen.findByTestId('jsx-kind-1')).toHaveTextContent('Alpha updated');
  });

  it('unmounts JSX slot roots when list unmounts', async () => {
    const onUnmount = vi.fn();
    const definition = createDefinition(onUnmount);
    const view = render(
      <TestControlledList
        items={[{ id: 'probe', label: 'Probe' }]}
        definition={definition}
      />
    );

    expect(await screen.findByTestId('jsx-kind-probe')).toHaveTextContent('Probe');

    view.unmount();

    await waitFor(() => {
      expect(onUnmount).toHaveBeenCalledWith('probe');
    });
  });
});





