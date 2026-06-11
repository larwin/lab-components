import type { Culture } from '@/core/culture';
import type { ItemDescriptor, RowKindDefinition } from '@/core/collection/shared/kind';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/runtime';

export interface EnumKindDescriptor extends ItemDescriptor {
  label: string;
  values: string[];
  selectedValues: string[];
  isDisabled: boolean;
}

export interface EnumKindDOMRefs {
  rootEl: HTMLDivElement;
  labelEl: HTMLSpanElement;
  valuesEl: HTMLDivElement;
}

export interface EnumKindOptions<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> {
  height: number;
  getLabel: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string;
  getValues: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string[];
  getSelectedValues?: (item: TItem, id: TId, runtime: TRuntime, culture?: Culture) => string[] | undefined;
}

export class RowKindEnumDefinition<
  TItem,
  TId extends ItemId = ItemId,
  TRuntime extends ItemRuntime = ItemRuntime,
> implements RowKindDefinition<TItem, TId, TRuntime, EnumKindDescriptor, EnumKindDOMRefs> {
  readonly kind = 'enum';
  readonly height: number;

  constructor(private readonly options: EnumKindOptions<TItem, TId, TRuntime>) {
    this.height = options.height;
  }

  computeDescriptor(item: TItem, id: TId, runtime: TRuntime, culture?: Culture): EnumKindDescriptor {
    const values = this.options.getValues(item, id, runtime, culture);
    const selectedValues = this.options.getSelectedValues?.(item, id, runtime, culture) ?? [];

    const classes = ['menu-kind', 'menu-kind--enum'];
    if (runtime.isFocused) classes.push('is-focused');
    if (runtime.isSelected) classes.push('is-selected');
    if (runtime.isDisabled) classes.push('is-disabled');

    return {
      label: this.options.getLabel(item, id, runtime, culture),
      values,
      selectedValues,
      isDisabled: runtime.isDisabled,
      className: classes.join(' '),
    };
  }

  create(container: HTMLElement): EnumKindDOMRefs {
    const rootEl = document.createElement('div');
    rootEl.className = 'menu-kind menu-kind--enum';

    const labelEl = document.createElement('span');
    labelEl.className = 'menu-kind__label';

    const valuesEl = document.createElement('div');
    valuesEl.className = 'menu-kind__enum-values';

    rootEl.appendChild(labelEl);
    rootEl.appendChild(valuesEl);
    container.appendChild(rootEl);

    return {
      rootEl,
      labelEl,
      valuesEl,
    };
  }

  update(refs: EnumKindDOMRefs, descriptor: EnumKindDescriptor): void {
    refs.rootEl.className = descriptor.className ?? 'menu-kind menu-kind--enum';
    refs.labelEl.textContent = descriptor.label;
    refs.valuesEl.innerHTML = '';
    const selected = new Set(descriptor.selectedValues);
    for (const value of descriptor.values) {
      const optionEl = document.createElement('button');
      optionEl.type = 'button';
      optionEl.className = selected.has(value)
        ? 'menu-kind__enum-option is-selected'
        : 'menu-kind__enum-option';
      optionEl.dataset.menuEnumValue = value;
      optionEl.textContent = value;
      refs.valuesEl.appendChild(optionEl);
    }

    if (descriptor.style) {
      Object.assign(refs.rootEl.style, descriptor.style);
    }
  }
}



