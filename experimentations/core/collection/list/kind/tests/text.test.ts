import { describe, it, expect } from 'vitest';
import { createRowKindTextDefinition } from '../text';
import type { ItemRuntime } from '../../state/types';

interface TextItem {
  id: string;
  label: string;
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

describe('createRowKindTextDefinition', () => {
  it('computeDescriptor builds descriptor from item and runtime', () => {
    const definition = createRowKindTextDefinition<TextItem>({
      height: 36,
      getLabel: (item) => item.label,
    });

    const descriptor = definition.computeDescriptor(
      { id: 'a', label: 'Alpha' },
      'a',
      createRuntime()
    );

    expect(descriptor).toMatchObject({
      label: 'Alpha',
      isSelected: false,
      isFocused: false,
      isDisabled: false,
      isChecked: false,
    });
  });

  it('injects selected/focused states in className', () => {
    const definition = createRowKindTextDefinition<TextItem>({
      height: 36,
      getLabel: (item) => item.label,
    });

    const descriptor = definition.computeDescriptor(
      { id: 'a', label: 'Alpha' },
      'a',
      createRuntime({ isSelected: true, isFocused: true, isDisabled: true, isChecked: true })
    );

    expect(descriptor.className).toContain('is-selected');
    expect(descriptor.className).toContain('is-focused');
    expect(descriptor.className).toContain('is-disabled');
    expect(descriptor.className).toContain('is-checked');
  });

  it('create and update render label in DOM', () => {
    const definition = createRowKindTextDefinition<TextItem>({
      height: 40,
      getLabel: (item) => item.label,
    });
    const container = document.createElement('div');

    const refs = definition.create(container);
    const descriptor = definition.computeDescriptor(
      { id: 'b', label: 'Beta' },
      'b',
      createRuntime({ isFocused: true })
    );

    definition.update(refs, descriptor);

    expect(refs.labelEl.textContent).toBe('Beta');
    expect(refs.contentEl.className).toContain('list-kind-text');
    expect(refs.contentEl.className).toContain('is-focused');
    expect(container.textContent).toContain('Beta');
  });
});

