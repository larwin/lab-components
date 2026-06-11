import { describe, it, expect, vi } from 'vitest';
import { createCulture, createTestCulture, resolveText } from '@/core/culture';
import { i18n } from '@/core/culture';

describe('createCulture', () => {
  it('returns key as-is when no translation source exists', () => {
    const culture = createCulture({ code: 'en-US' });
    expect(culture.translate('list.noItems')).toBe('list.noItems');
  });

  it('translates from messages with interpolation', () => {
    const culture = createCulture({
      code: 'en-US',
      messages: {
        'items.count': 'Items: {{n}}',
      },
    });

    expect(culture.translate('items.count', { n: 42 })).toBe('Items: 42');
  });

  it('prefers a custom translate function over messages', () => {
    const culture = createCulture({
      code: 'en-US',
      messages: {
        hello: 'Hello',
      },
      translate: (key) => (key === 'hello' ? 'Custom hello' : key),
    });

    expect(culture.translate('hello')).toBe('Custom hello');
  });

  it('formats numbers according to culture', () => {
    const culture = createCulture({ code: 'fr-FR' });
    const result = culture.format.number(1234567);
    expect(result.replace(/\s/g, ' ')).toContain('1');
  });

  it('formats dates according to culture', () => {
    const culture = createCulture({ code: 'en-US' });
    const date = new Date('2024-03-12');
    const result = culture.format.date(date);
    expect(result).toContain('2024');
  });

  it('formats percent', () => {
    const culture = createCulture({ code: 'en-US' });
    expect(culture.format.percent!(0.42)).toContain('42');
  });

  it('allows partial formatter overrides while keeping defaults', () => {
    const culture = createCulture({
      code: 'en-US',
      format: {
        number: (n) => `#${n}`,
      },
    });

    expect(culture.format.number(12)).toBe('#12');
    expect(culture.format.date(new Date('2024-03-12'))).toContain('2024');
  });

  it('reuses cached Intl formatters for identical number and date options', () => {
    const numberSpy = vi.spyOn(Intl, 'NumberFormat');
    const dateSpy = vi.spyOn(Intl, 'DateTimeFormat');
    const culture = createCulture({ code: 'nl-NL' });

    culture.format.number(10, { style: 'currency', currency: 'EUR', minimumFractionDigits: 3 });
    culture.format.number(20, { style: 'currency', currency: 'EUR', minimumFractionDigits: 3 });
    culture.format.number(30);

    culture.format.date(new Date('2024-03-12'), { dateStyle: 'full' });
    culture.format.date(new Date('2025-01-01'), { dateStyle: 'full' });
    culture.format.date(new Date('2025-01-01'));

    expect(numberSpy).toHaveBeenCalledTimes(2);
    expect(dateSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps custom formatter overrides ahead of the default Intl cache', () => {
    const numberSpy = vi.spyOn(Intl, 'NumberFormat');
    const culture = createCulture({
      code: 'en-US',
      format: {
        number: (n) => `#${n}`,
      },
    });

    expect(culture.format.number(12)).toBe('#12');
    expect(numberSpy).not.toHaveBeenCalled();
  });
});

describe('createTestCulture', () => {
  it('keeps the lightweight default behavior for tests', () => {
    const culture = createTestCulture('en-US');
    expect(culture.translate('rows.{{n}}', { n: 42 })).toBe('rows.42');
  });
});

describe('resolveText', () => {
  it('resolves literal text without calling translate()', () => {
    const culture = createTestCulture();
    const translateSpy = vi.fn(() => 'ignored');
    const result = resolveText(i18n.literal('Hello'), { ...culture, translate: translateSpy });
    expect(result).toBe('Hello');
    expect(translateSpy).not.toHaveBeenCalled();
  });

  it('resolves key text by calling culture.translate()', () => {
    const culture = createTestCulture();
    const customCulture = { ...culture, translate: () => 'Translated' };
    expect(resolveText(i18n.key('some.key'), customCulture)).toBe('Translated');
  });
});


