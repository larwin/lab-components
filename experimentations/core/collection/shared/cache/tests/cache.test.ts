import { describe, it, expect } from 'vitest';
import { CollectionCache } from '../cache';

describe('CollectionCache - values store', () => {
  it('supports set/get/has for named values', () => {
    const cache = new CollectionCache<string>();

    expect(cache.hasValue('item-1', 'text', 'computedLabel')).toBe(false);
    expect(cache.getValue('item-1', 'text', 'computedLabel')).toBeUndefined();

    cache.setValue('item-1', 'text', 'computedLabel', 'Hello');

    expect(cache.hasValue('item-1', 'text', 'computedLabel')).toBe(true);
    expect(cache.getValue('item-1', 'text', 'computedLabel')).toBe('Hello');
  });
});

describe('CollectionCache - invalidateAll', () => {
  it('clears all cached values', () => {
    const cache = new CollectionCache<string>();

    cache.setValue('item-1', 'text', 'foo', 123);
    cache.setValue('item-2', 'text', 'bar', 456);

    cache.invalidateAll();

    expect(cache.hasValue('item-1', 'text', 'foo')).toBe(false);
    expect(cache.hasValue('item-2', 'text', 'bar')).toBe(false);
    expect(cache.getValue('item-1', 'text', 'foo')).toBeUndefined();
    expect(cache.getValue('item-2', 'text', 'bar')).toBeUndefined();
  });
});

describe('CollectionCache - composite keys', () => {
  it('does not collide when ids and names contain separators', () => {
    const cache = new CollectionCache<string>();

    cache.setValue('a::b', 'k::1', 'v::1', 'left');
    cache.setValue('a', 'k', 'b::v::1', 'right');

    expect(cache.getValue('a::b', 'k::1', 'v::1')).toBe('left');
    expect(cache.getValue('a', 'k', 'b::v::1')).toBe('right');
  });

  it('supports number and string ids without collision', () => {
    const cache = new CollectionCache<string | number>();

    cache.setValue(1, 'text', 'value', 'number-id');
    cache.setValue('1', 'text', 'value', 'string-id');

    expect(cache.getValue(1, 'text', 'value')).toBe('number-id');
    expect(cache.getValue('1', 'text', 'value')).toBe('string-id');
  });
});
