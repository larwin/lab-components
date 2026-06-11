import { resolveI18nText } from '@/core/culture';
import type { ItemRuntime } from '@/core/collection/shared/runtime';
import type { MenuLabel } from '@/core/collection/menu/types';

export function resolveMenuLabel(label: MenuLabel | undefined, fallback: string): string {
  if (label == null) {
    return fallback;
  }

  if (typeof label === 'string') {
    return label;
  }

  return resolveI18nText(label, undefined);
}

export function buildMenuKindClassName(
  base: string,
  runtime: ItemRuntime,
  options?: { checked?: boolean }
): string {
  const classes = ['menu-kind', base];

  if (runtime.isFocused) classes.push('is-focused');
  if (runtime.isSelected) classes.push('is-selected');
  if (runtime.isDisabled) classes.push('is-disabled');
  if (options?.checked) classes.push('is-checked');

  return classes.join(' ');
}

export function resolveMenuIcon(icon: string | null | undefined): string | null {
  return icon ?? null;
}




