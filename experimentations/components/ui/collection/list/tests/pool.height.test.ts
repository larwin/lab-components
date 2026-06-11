import { describe, expect, it } from 'vitest';
import type { ItemHeightPolicy } from '@/core/collection/virtual';
import { resolvePoolItemHeight } from '../List';

describe('resolvePoolItemHeight', () => {
  it('for byKind without poolItemHeight returns defaultHeight even with tiny separator', () => {
    const policy: ItemHeightPolicy = {
      kind: 'byKind',
      heights: { default: 36, separator: 1, text: 36 },
      defaultHeight: 36,
    };

    expect(resolvePoolItemHeight(policy)).toBe(36);
  });

  it('for byKind with explicit poolItemHeight returns explicit value', () => {
    const policy: ItemHeightPolicy = {
      kind: 'byKind',
      heights: { default: 36, separator: 1, text: 36 },
      defaultHeight: 36,
      poolItemHeight: 48,
    };

    expect(resolvePoolItemHeight(policy)).toBe(48);
  });

  it('for fixed without poolItemHeight returns itemHeight', () => {
    const policy: ItemHeightPolicy = {
      kind: 'fixed',
      itemHeight: 40,
    };

    expect(resolvePoolItemHeight(policy)).toBe(40);
  });
});




