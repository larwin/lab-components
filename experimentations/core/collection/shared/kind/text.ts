import type { Culture } from '@/core/culture';
import type { ItemId, ItemRuntime } from '../runtime';
import type { ItemDescriptor, RowKindDefinition } from './types';

export interface TextKindDescriptor extends ItemDescriptor {
  label: string;
  isSelected: boolean;
  isFocused: boolean;
  isDisabled: boolean;
  isChecked: boolean;
}

export interface TextKindDOMRefs {
  contentEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
}

export function createRowKindTextDefinition<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
>(options: {
  height: number;
  getLabel: (item: TItem) => string;
}): RowKindDefinition<TItem, TId, TRuntime, TextKindDescriptor, TextKindDOMRefs> {
  return {
    kind: 'text',
    height: options.height,

    computeDescriptor(item: TItem, _id: TId, runtime: TRuntime, _culture?: Culture): TextKindDescriptor {
      const classNames = ['list-kind-text'];
      if (runtime.isSelected) classNames.push('is-selected');
      if (runtime.isFocused) classNames.push('is-focused');
      if (runtime.isDisabled) classNames.push('is-disabled');
      if (runtime.isChecked) classNames.push('is-checked');

      return {
        label: options.getLabel(item),
        isSelected: runtime.isSelected,
        isFocused: runtime.isFocused,
        isDisabled: runtime.isDisabled,
        isChecked: runtime.isChecked,
        className: classNames.join(' '),
      };
    },

    create(container: HTMLElement): TextKindDOMRefs {
      const contentEl = document.createElement('div');
      contentEl.className = 'list-kind-text';

      const labelEl = document.createElement('span');
      labelEl.className = 'list-kind-text__label';

      contentEl.appendChild(labelEl);
      container.appendChild(contentEl);

      return { contentEl, labelEl };
    },

    update(refs: TextKindDOMRefs, descriptor: TextKindDescriptor): void {
      refs.labelEl.textContent = descriptor.label;
      refs.contentEl.className = descriptor.className ?? 'list-kind-text';

      if (descriptor.style) {
        Object.assign(refs.contentEl.style, descriptor.style);
      }
    },
  };
}
