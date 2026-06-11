import { describe, expect, it, vi } from 'vitest';
import { FLAT_HIERARCHY } from '@/core/collection/shared/hierarchy';
import type { AnyRowKindDefinition } from '../../definition/types';
import type { ItemRuntime } from '../../state/types';
import { computeDescriptorWithInheritance, updateWithInheritance } from '../inheritance';

interface Item {
  id: string;
  label: string;
}

interface Descriptor {
  label: string;
}

function createRuntime(kind = 'child'): ItemRuntime {
  return {
    kind,
    isFocused: false,
    isSelected: false,
    isChecked: false,
    isDisabled: false,
    isExpanded: false,
    isExpandable: false,
    isVisible: true,
    hierarchy: FLAT_HIERARCHY,
  };
}

describe('kind inheritance', () => {
  it('allows child computeDescriptor and update to delegate to base()', () => {
    const updateLog: string[] = [];
    const baseKind: AnyRowKindDefinition<Item, string> = {
      kind: 'base',
      height: 30,
      computeDescriptor: (item) => ({ label: item.label }),
      create: () => ({ label: '' }),
      update: (refs: { label: string }, descriptor: Descriptor) => {
        refs.label = descriptor.label;
        updateLog.push(`base:${descriptor.label}`);
      },
    };

    const childKind: AnyRowKindDefinition<Item, string> = {
      kind: 'child',
      extends: 'base',
      height: 34,
      computeDescriptor: (item, _id, _runtime, _culture, base) => {
        const fromBase = base?.() as Descriptor | undefined;
        return {
          label: `${fromBase?.label ?? item.label} (child)`,
        };
      },
      create: () => ({ label: '' }),
      update: (refs: { label: string }, descriptor: Descriptor, base) => {
        base?.();
        refs.label = `${refs.label}!`;
        updateLog.push(`child:${descriptor.label}`);
      },
    };

    const kindMap: Record<string, AnyRowKindDefinition<Item, string>> = {
      default: childKind,
      base: baseKind,
      child: childKind,
    };

    const descriptor = computeDescriptorWithInheritance(
      kindMap,
      'child',
      { id: '1', label: 'Alpha' },
      '1',
      createRuntime('child')
    );
    expect(descriptor).toEqual({ label: 'Alpha (child)' });

    const refs = { label: '' };
    updateWithInheritance(kindMap, 'child', refs, descriptor);
    expect(refs.label).toBe('Alpha (child)!');
    expect(updateLog).toEqual(['base:Alpha (child)', 'child:Alpha (child)']);
  });

  it('throws when a kind extends an unknown base kind', () => {
    const danglingKind: AnyRowKindDefinition<Item, string> = {
      kind: 'dangling',
      extends: 'missing',
      height: 30,
      computeDescriptor: (item) => ({ label: item.label }),
      create: () => ({}),
      update: () => {},
    };

    expect(() => computeDescriptorWithInheritance(
      { default: danglingKind, dangling: danglingKind },
      'dangling',
      { id: '1', label: 'Alpha' },
      '1',
      createRuntime('dangling')
    )).toThrow('extends unknown kind "missing"');
  });

  it('throws on circular inheritance', () => {
    const a: AnyRowKindDefinition<Item, string> = {
      kind: 'a',
      extends: 'b',
      height: 30,
      computeDescriptor: (item) => ({ label: item.label }),
      create: () => ({}),
      update: () => {},
    };
    const b: AnyRowKindDefinition<Item, string> = {
      kind: 'b',
      extends: 'a',
      height: 30,
      computeDescriptor: (item) => ({ label: item.label }),
      create: () => ({}),
      update: () => {},
    };

    expect(() => computeDescriptorWithInheritance(
      { default: a, a, b },
      'a',
      { id: '1', label: 'Alpha' },
      '1',
      createRuntime('a')
    )).toThrow('Circular kind inheritance detected');
  });

  it('computes base descriptor once even when base() is called multiple times', () => {
    const baseCompute = vi.fn((item: Item) => ({ label: item.label }));
    const baseKind: AnyRowKindDefinition<Item, string> = {
      kind: 'base',
      height: 30,
      computeDescriptor: baseCompute,
      create: () => ({}),
      update: () => {},
    };
    const childKind: AnyRowKindDefinition<Item, string> = {
      kind: 'child',
      extends: 'base',
      height: 30,
      computeDescriptor: (_item, _id, _runtime, _culture, base) => {
        const first = base?.() as Descriptor;
        const second = base?.() as Descriptor;
        return { label: `${first.label}|${second.label}` };
      },
      create: () => ({}),
      update: () => {},
    };

    const descriptor = computeDescriptorWithInheritance(
      { default: childKind, base: baseKind, child: childKind },
      'child',
      { id: '1', label: 'Alpha' },
      '1',
      createRuntime('child')
    );

    expect(descriptor).toEqual({ label: 'Alpha|Alpha' });
    expect(baseCompute).toHaveBeenCalledTimes(1);
  });
});

