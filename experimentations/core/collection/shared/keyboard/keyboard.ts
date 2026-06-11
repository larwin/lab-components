export type KeyboardStrategy = 'list' | 'grid' | 'menu' | 'none';

export function getFirstFocusableId<TId>(
  ids: TId[],
  isFocusable: (id: TId) => boolean
): TId | null {
  for (const id of ids) {
    if (isFocusable(id)) {
      return id;
    }
  }

  return null;
}

export function getLastFocusableId<TId>(
  ids: TId[],
  isFocusable: (id: TId) => boolean
): TId | null {
  for (let index = ids.length - 1; index >= 0; index--) {
    const id = ids[index];
    if (isFocusable(id)) {
      return id;
    }
  }

  return null;
}

export function getNextFocusableId<TId>(
  ids: TId[],
  currentId: TId | null,
  isFocusable: (id: TId) => boolean
): TId | null {
  if (ids.length === 0) {
    return null;
  }

  if (currentId == null) {
    return getFirstFocusableId(ids, isFocusable);
  }

  const currentIndex = ids.indexOf(currentId);
  if (currentIndex === -1) {
    return getFirstFocusableId(ids, isFocusable);
  }

  for (let index = currentIndex + 1; index < ids.length; index++) {
    const candidate = ids[index];
    if (isFocusable(candidate)) {
      return candidate;
    }
  }

  if (isFocusable(currentId)) {
    return currentId;
  }

  return getLastFocusableId(ids, isFocusable);
}

export function getPrevFocusableId<TId>(
  ids: TId[],
  currentId: TId | null,
  isFocusable: (id: TId) => boolean
): TId | null {
  if (ids.length === 0) {
    return null;
  }

  if (currentId == null) {
    return getLastFocusableId(ids, isFocusable);
  }

  const currentIndex = ids.indexOf(currentId);
  if (currentIndex === -1) {
    return getLastFocusableId(ids, isFocusable);
  }

  for (let index = currentIndex - 1; index >= 0; index--) {
    const candidate = ids[index];
    if (isFocusable(candidate)) {
      return candidate;
    }
  }

  if (isFocusable(currentId)) {
    return currentId;
  }

  return getFirstFocusableId(ids, isFocusable);
}
