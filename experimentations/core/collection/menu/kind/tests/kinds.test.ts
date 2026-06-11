import { describe, expect, it } from 'vitest';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import { RowKindActionDefinition } from '../action';
import { RowKindCheckboxDefinition } from '../checkbox';
import { RowKindInputDefinition } from '../input';
import { RowKindEnumDefinition } from '../enum';

interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  hasSubmenu?: boolean;
  value?: string;
  enumValues?: string[];
  selectedValues?: string[];
}

function createRuntime(overrides: Partial<ItemRuntime> = {}): ItemRuntime {
  return {
    kind: 'action',
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

describe('menu built-in kinds', () => {
  it('RowKindActionDefinition computes descriptor and updates DOM', () => {
    const kind = new RowKindActionDefinition<MenuItem, string, ItemRuntime>({
      height: 32,
      getLabel: (item) => item.label,
      getIcon: (item) => item.icon,
      hasSubmenu: (item) => Boolean(item.hasSubmenu),
    });
    const runtime = createRuntime({ isFocused: true });

    const descriptor = kind.computeDescriptor(
      { id: 'a', label: 'Open', icon: 'folder', hasSubmenu: true },
      'a',
      runtime,
    );
    expect(descriptor).toMatchObject({
      label: 'Open',
      icon: 'folder',
      hasSubmenu: true,
      isFocused: true,
    });
    expect(descriptor.className).toContain('menu-kind--action');

    const container = document.createElement('div');
    const refs = kind.create(container);
    kind.update(refs, descriptor);

    expect(refs.labelEl.textContent).toBe('Open');
    expect(refs.iconEl.textContent).toBe('folder');
    expect(refs.arrowEl.textContent).toBe('>');
  });

  it('RowKindCheckboxDefinition reflects runtime.isChecked and updates checkbox DOM', () => {
    const kind = new RowKindCheckboxDefinition<MenuItem, string, ItemRuntime>({
      height: 32,
      getLabel: (item) => item.label,
    });
    const runtime = createRuntime({ isChecked: true, isDisabled: true });

    const descriptor = kind.computeDescriptor(
      { id: 'b', label: 'Show hidden files' },
      'b',
      runtime,
    );
    expect(descriptor.checked).toBe(true);
    expect(descriptor.isDisabled).toBe(true);

    const container = document.createElement('div');
    const refs = kind.create(container);
    kind.update(refs, descriptor);

    expect(refs.labelEl.textContent).toBe('Show hidden files');
    expect(refs.checkboxEl.checked).toBe(true);
    expect(refs.checkboxEl.disabled).toBe(true);
    expect(refs.checkboxEl.dataset.listCheckbox).toBe('true');
  });

  it('RowKindInputDefinition maps label/value/type and updates input DOM', () => {
    const kind = new RowKindInputDefinition<MenuItem, string, ItemRuntime>({
      height: 36,
      getLabel: (item) => item.label,
      getValue: (item) => item.value,
      getPlaceholder: () => 'Type value...',
      getInputType: () => 'text',
    });

    const descriptor = kind.computeDescriptor(
      { id: 'c', label: 'Filter', value: 'abc' },
      'c',
      createRuntime(),
    );
    expect(descriptor).toMatchObject({
      label: 'Filter',
      value: 'abc',
      placeholder: 'Type value...',
      inputType: 'text',
    });

    const container = document.createElement('div');
    const refs = kind.create(container);
    kind.update(refs, descriptor);

    expect(refs.labelEl.textContent).toBe('Filter');
    expect(refs.inputEl.value).toBe('abc');
    expect(refs.inputEl.placeholder).toBe('Type value...');
    expect(refs.inputEl.type).toBe('text');
  });

  it('RowKindEnumDefinition resolves selected values and updates value text', () => {
    const kind = new RowKindEnumDefinition<MenuItem, string, ItemRuntime>({
      height: 36,
      getLabel: (item) => item.label,
      getValues: (item) => item.enumValues ?? [],
      getSelectedValues: (item) => item.selectedValues ?? [],
    });

    const descriptor = kind.computeDescriptor(
      {
        id: 'd',
        label: 'Status',
        enumValues: ['open', 'closed', 'pending'],
        selectedValues: ['open', 'pending'],
      },
      'd',
      createRuntime(),
    );

    expect(descriptor.values).toEqual(['open', 'closed', 'pending']);
    expect(descriptor.selectedValues).toEqual(['open', 'pending']);

    const container = document.createElement('div');
    const refs = kind.create(container);
    kind.update(refs, descriptor);

    expect(refs.labelEl.textContent).toBe('Status');
    const options = Array.from(refs.valuesEl.querySelectorAll<HTMLButtonElement>('[data-menu-enum-value]'));
    expect(options.map((entry) => entry.dataset.menuEnumValue)).toEqual(['open', 'closed', 'pending']);
    expect(options.filter((entry) => entry.classList.contains('is-selected')).map((entry) => entry.dataset.menuEnumValue))
      .toEqual(['open', 'pending']);
  });
});



