import { describe, it, expect } from 'vitest';
import { resolveI18nText, i18n } from '../i18n';

describe('resolveI18nText', () => {
  it('returns literal value directly', () => {
    expect(resolveI18nText(i18n.literal('Hello'))).toBe('Hello');
  });

  it('returns translated string when t() resolves the key', () => {
    const t = (key: string) => (key === 'greeting' ? 'Bonjour' : key);
    expect(resolveI18nText(i18n.key('greeting'), t)).toBe('Bonjour');
  });

  it('returns fallback when t() returns the key unchanged', () => {
    const t = (key: string) => key;
    expect(resolveI18nText(i18n.key('missing.key', undefined, 'Default'), t)).toBe('Default');
  });

  it('returns the key itself when no t() and no fallback', () => {
    expect(resolveI18nText(i18n.key('some.key'))).toBe('some.key');
  });

  it('returns fallback when no t() but fallback exists', () => {
    expect(resolveI18nText(i18n.key('some.key', undefined, 'Fallback'))).toBe('Fallback');
  });

  it('returns key unchanged when t() result equals key (no fallback)', () => {
    const t = (key: string, params?: Record<string, unknown>) =>
      key.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params?.[k] ?? ''));

    const text = i18n.key('rows.count', { n: 42 });
    expect(resolveI18nText(text, t)).toBe('rows.count');
  });
});

describe('i18n helpers', () => {
  it('i18n.literal creates correct shape', () => {
    const text = i18n.literal('Name');
    expect(text).toEqual({ kind: 'literal', value: 'Name' });
  });

  it('i18n.key creates correct shape with params', () => {
    const text = i18n.key('col.name', { n: 1 }, 'Name');
    expect(text).toEqual({ kind: 'key', key: 'col.name', params: { n: 1 }, fallback: 'Name' });
  });
});
