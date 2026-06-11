import React from 'react';
import type { AnyRowKindDefinition } from '@/core/collection/shared/definition/types';
import { LIST_DEFAULT_ITEM_HEIGHT } from '@/core/collection/list/constants';
import type { ItemDescriptor } from '@/core/collection/list/kind/types';
import type { ItemId } from '@/core/collection/shared/runtime';
import type { ItemRuntime } from '@/core/collection/shared/state/types';
import { createJSXKind } from '../kind/jsx-kind';

interface CheckboxDescriptor extends ItemDescriptor {
  label: string;
  isChecked: boolean;
  isDisabled: boolean;
}

function CheckboxRow({ label, isChecked, isDisabled }: CheckboxDescriptor) {
  return (
    <label className="list-preset-checkbox">
      <input
        type="checkbox"
        checked={isChecked}
        disabled={isDisabled}
        readOnly
        data-list-checkbox="true"
      />
      <span className="list-preset-checkbox__label">{label}</span>
    </label>
  );
}

export interface CheckboxKindOptions<TItem> {
  getLabel: (item: TItem, runtime: ItemRuntime) => string;
  height?: number;
}

export function createCheckboxKind<TItem, TId extends ItemId = ItemId>(
  options: CheckboxKindOptions<TItem>
): AnyRowKindDefinition<TItem, TId> {
  return createJSXKind<TItem, TId, CheckboxDescriptor>({
    kind: 'checkbox',
    height: options.height ?? LIST_DEFAULT_ITEM_HEIGHT,
    computeDescriptor(item, _id, runtime) {
      return {
        label: options.getLabel(item, runtime),
        isChecked: runtime.isChecked,
        isDisabled: runtime.isDisabled,
      };
    },
    Component: CheckboxRow,
  });
}




