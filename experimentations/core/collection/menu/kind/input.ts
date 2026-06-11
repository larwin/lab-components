import type { Culture } from '@/core/culture';
import type { ItemDescriptor, RowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';

type InputType = 'text' | 'number' | 'date';

export interface InputKindDescriptor extends ItemDescriptor {
  label: string;
  value: string;
  placeholder: string;
  inputType: InputType;
  isDisabled: boolean;
}

export interface InputKindDOMRefs {
  rootEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
  inputEl: HTMLInputElement;
}

export interface InputKindOptions<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> {
  height: number;
  getLabel: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string;
  getValue?: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string | number | null | undefined;
  getPlaceholder?: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string | undefined;
  getInputType?: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => InputType | undefined;
}

export class RowKindInputDefinition<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> implements RowKindDefinition<TItem, TId, TRuntime, InputKindDescriptor, InputKindDOMRefs> {
  readonly kind = 'input';
  readonly height: number;

  constructor(private readonly options: InputKindOptions<TItem, TId, TRuntime>) {
    this.height = options.height;
  }

  computeDescriptor(item: TItem, id: TId, runtime: TRuntime, culture?: Culture): InputKindDescriptor {
    const rawValue = this.options.getValue?.(item, id, runtime, culture);
    const classes = ['menu-kind', 'menu-kind--input'];
    if (runtime.isFocused) classes.push('is-focused');
    if (runtime.isSelected) classes.push('is-selected');
    if (runtime.isDisabled) classes.push('is-disabled');

    return {
      label: this.options.getLabel(item, id, runtime, culture),
      value: rawValue == null ? '' : String(rawValue),
      placeholder: this.options.getPlaceholder?.(item, id, runtime, culture) ?? '',
      inputType: this.options.getInputType?.(item, id, runtime, culture) ?? 'text',
      isDisabled: runtime.isDisabled,
      className: classes.join(' '),
    };
  }

  create(container: HTMLElement): InputKindDOMRefs {
    const rootEl = document.createElement('div');
    rootEl.className = 'menu-kind menu-kind--input';

    const labelEl = document.createElement('span');
    labelEl.className = 'menu-kind__label';

    const inputEl = document.createElement('input');
    inputEl.className = 'menu-kind__input';
    inputEl.dataset.menuInput = 'true';

    rootEl.appendChild(labelEl);
    rootEl.appendChild(inputEl);
    container.appendChild(rootEl);

    return {
      rootEl,
      labelEl,
      inputEl,
    };
  }

  update(refs: InputKindDOMRefs, descriptor: InputKindDescriptor): void {
    refs.rootEl.className = descriptor.className ?? 'menu-kind menu-kind--input';
    refs.labelEl.textContent = descriptor.label;
    refs.inputEl.type = descriptor.inputType;
    refs.inputEl.value = descriptor.value;
    refs.inputEl.placeholder = descriptor.placeholder;
    refs.inputEl.disabled = descriptor.isDisabled;

    if (descriptor.style) {
      Object.assign(refs.rootEl.style, descriptor.style);
    }
  }
}



