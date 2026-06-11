import type { Culture } from '@/core/culture';
import type { ItemDescriptor, RowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';

export interface CheckboxKindDescriptor extends ItemDescriptor {
  label: string;
  checked: boolean;
  isDisabled: boolean;
}

export interface CheckboxKindDOMRefs {
  rootEl: HTMLDivElement;
  checkboxEl: HTMLInputElement;
  labelEl: HTMLSpanElement;
}

export interface CheckboxKindOptions<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> {
  height: number;
  getLabel: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string;
}

export class RowKindCheckboxDefinition<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> implements RowKindDefinition<TItem, TId, TRuntime, CheckboxKindDescriptor, CheckboxKindDOMRefs> {
  readonly kind = 'checkbox';
  readonly height: number;

  constructor(private readonly options: CheckboxKindOptions<TItem, TId, TRuntime>) {
    this.height = options.height;
  }

  computeDescriptor(item: TItem, id: TId, runtime: TRuntime, culture?: Culture): CheckboxKindDescriptor {
    const classes = ['menu-kind', 'menu-kind--checkbox'];
    if (runtime.isFocused) classes.push('is-focused');
    if (runtime.isSelected) classes.push('is-selected');
    if (runtime.isDisabled) classes.push('is-disabled');
    if (runtime.isChecked) classes.push('is-checked');

    return {
      label: this.options.getLabel(item, id, runtime, culture),
      checked: runtime.isChecked,
      isDisabled: runtime.isDisabled,
      className: classes.join(' '),
    };
  }

  create(container: HTMLElement): CheckboxKindDOMRefs {
    const rootEl = document.createElement('div');
    rootEl.className = 'menu-kind menu-kind--checkbox';

    const checkboxEl = document.createElement('input');
    checkboxEl.type = 'checkbox';
    checkboxEl.className = 'menu-kind__checkbox';
    checkboxEl.dataset.listCheckbox = 'true';

    const labelEl = document.createElement('span');
    labelEl.className = 'menu-kind__label';

    rootEl.appendChild(checkboxEl);
    rootEl.appendChild(labelEl);
    container.appendChild(rootEl);

    return {
      rootEl,
      checkboxEl,
      labelEl,
    };
  }

  update(refs: CheckboxKindDOMRefs, descriptor: CheckboxKindDescriptor): void {
    refs.rootEl.className = descriptor.className ?? 'menu-kind menu-kind--checkbox';
    refs.checkboxEl.checked = descriptor.checked;
    refs.checkboxEl.disabled = descriptor.isDisabled;
    refs.labelEl.textContent = descriptor.label;

    if (descriptor.style) {
      Object.assign(refs.rootEl.style, descriptor.style);
    }
  }
}



