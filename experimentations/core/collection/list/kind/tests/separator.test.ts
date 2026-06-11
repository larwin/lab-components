import { describe, it, expect } from 'vitest';
import { RowKindSeparatorDefinition } from '../separator';
import type { ItemRuntime } from '../../state/types';

function createRuntime(): ItemRuntime {
  return {
    kind: 'separator',
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
  };
}

describe('RowKindSeparatorDefinition', () => {
  it('has fixed height of 1', () => {
    const definition = new RowKindSeparatorDefinition();

    expect(definition.height).toBe(1);
    expect(definition.kind).toBe('separator');
  });

  it('computeDescriptor returns an empty object', () => {
    const definition = new RowKindSeparatorDefinition<{ id: string }, string>();

    const descriptor = definition.computeDescriptor(
      { id: 'sep-1' },
      'sep-1',
      createRuntime()
    );

    expect(descriptor).toEqual({});
  });

  it('create builds separator DOM', () => {
    const definition = new RowKindSeparatorDefinition();
    const container = document.createElement('div');

    const refs = definition.create(container);

    expect(refs.lineEl.tagName).toBe('HR');
    expect(container.querySelector('hr')).toBe(refs.lineEl);
    expect(refs.lineEl.className).toBe('list-kind-separator');
  });

  it('update is a no-op and does not throw', () => {
    const definition = new RowKindSeparatorDefinition();
    const container = document.createElement('div');
    const refs = definition.create(container);

    expect(() => definition.update(refs, {})).not.toThrow();
  });
});

