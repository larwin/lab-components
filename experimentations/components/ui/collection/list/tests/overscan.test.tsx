import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defineCollection } from '@/core/collection/shared/definition/facade';
import type { AnyRowKindDefinition } from '@/core/collection/shared/definition/types';
import { TestControlledList } from './TestControlledList';

interface Item {
  id: string;
  label: string;
}

interface ItemRefs {
  labelEl: HTMLSpanElement;
}

const textKind: AnyRowKindDefinition<Item, string> = {
  kind: 'text',
  height: 20,
  computeDescriptor(item) {
    return { label: item.label };
  },
  create(container) {
    const labelEl = document.createElement('span');
    container.appendChild(labelEl);
    return { labelEl };
  },
  update(refs: ItemRefs, descriptor: { label?: string }) {
    refs.labelEl.textContent = descriptor.label ?? '';
  },
};

const definition = defineCollection<Item, string>({
  getItemId: (item) => item.id,
  getItemKind: () => 'text',
  kindMap: {
    default: textKind,
    text: textKind,
  },
});

const items = Array.from({ length: 100 }, (_, index) => ({
  id: `id-${index}`,
  label: `Row ${index}`,
}));

describe('List overscan', () => {
  it('resizes the pool when overscan changes', async () => {
    const { rerender } = render(
      <TestControlledList
        items={items}
        definition={definition}
        height={200}
        overscan={1}
        itemHeightPolicy={{ kind: 'fixed', itemHeight: 20 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('virtual-pool-container').children.length).toBe(23);
    });

    rerender(
      <TestControlledList
        items={items}
        definition={definition}
        height={200}
        overscan={10}
        itemHeightPolicy={{ kind: 'fixed', itemHeight: 20 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('virtual-pool-container').children.length).toBe(41);
    });
  });
});





