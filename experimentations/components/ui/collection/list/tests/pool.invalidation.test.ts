import { describe, expect, it } from 'vitest';
import type { AnyRowKindDefinition } from '@/core/collection/shared/definition/types';
import { buildItemHeightPolicyKey, buildKindMapKey, buildPoolStructureKey, computePoolSize, shouldRebuildPool } from '@/components/ui/collection/virtual/pool.invalidation';

function createKind(kind: string, height: number): AnyRowKindDefinition<{ id: string }, string> {
  return {
    kind,
    height,
    computeDescriptor() {
      return {};
    },
    create() {
      return {};
    },
    update() {},
  };
}

describe('pool invalidation', () => {
  it('builds stable keys for by-kind policy regardless of insertion order', () => {
    const left = buildItemHeightPolicyKey({
      kind: 'byKind',
      defaultHeight: 24,
      poolItemHeight: 36,
      heights: { text: 30, separator: 1, heading: 36 },
    });
    const right = buildItemHeightPolicyKey({
      kind: 'byKind',
      defaultHeight: 24,
      poolItemHeight: 36,
      heights: { heading: 36, separator: 1, text: 30 },
    });

    expect(left).toBe(right);
    expect(left).toBe('byKind:24:36:heading:36|separator:1|text:30');
  });

  it('includes kind map structure in the pool key', () => {
    const kindMap = {
      default: createKind('text', 30),
      separator: createKind('separator', 1),
    };

    const kindKey = buildKindMapKey(kindMap);
    const structureKey = buildPoolStructureKey({ kind: 'fixed', itemHeight: 30 }, kindMap);

    expect(kindKey).toBe('default:text:30|separator:separator:1');
    expect(structureKey).toBe('fixed:30:::default:text:30|separator:separator:1');
  });

  it('rebuilds when kinds changed or pool size changed', () => {
    expect(shouldRebuildPool({
      previousStructureKey: 'fixed:30::default:text:30',
      nextStructureKey: 'fixed:30::default:text:30',
      previousPoolSize: 20,
      nextPoolSize: 20,
    })).toBe(false);

    expect(shouldRebuildPool({
      previousStructureKey: 'fixed:30::default:text:30',
      nextStructureKey: 'fixed:30::default:action:30',
      previousPoolSize: 20,
      nextPoolSize: 20,
    })).toBe(true);

    expect(shouldRebuildPool({
      previousStructureKey: 'fixed:30::default:text:30',
      nextStructureKey: 'fixed:30::default:text:30',
      previousPoolSize: 20,
      nextPoolSize: 24,
    })).toBe(true);
  });

  it('computes mandatory virtualized pool size from viewport and overscan', () => {
    expect(computePoolSize(400, 36, 3)).toBe(19);
  });
});





