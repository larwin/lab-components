function parseVisibleIndex(rawVisibleIndex: string | undefined): number | null {
  if (!rawVisibleIndex) {
    return null;
  }

  const visibleIndex = Number.parseInt(rawVisibleIndex, 10);
  if (!Number.isFinite(visibleIndex) || visibleIndex < 0) {
    return null;
  }

  return visibleIndex;
}

export function getPooledItemElementFromEventTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest('.list-pooled-item');
}

export function getVisibleIndexFromPooledItemElement(pooledItem: Element | null | undefined): number | null {
  return parseVisibleIndex((pooledItem as HTMLElement | null | undefined)?.dataset.visibleIndex);
}

export function getVisibleIndexFromEventTarget(target: EventTarget | null): number | null {
  return getVisibleIndexFromPooledItemElement(getPooledItemElementFromEventTarget(target));
}
