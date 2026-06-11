import { RowKindSeparatorDefinition } from '../kind/separator';
import type { ItemId } from '../runtime';
import { DEFAULT_SELECTION_MODE } from '../selection';
import type {
  CollectionCapabilities,
  CollectionConfig,
  CollectionDefinition,
  AnyRowKindDefinition,
} from './types';

const DEFAULT_CAPABILITIES: Required<CollectionCapabilities> = {
  selection: DEFAULT_SELECTION_MODE,
  check: true,
  expand: true,
};

function normalizeCapabilities(capabilities?: CollectionCapabilities): Required<CollectionCapabilities> {
  return {
    ...DEFAULT_CAPABILITIES,
    ...capabilities,
  };
}

function normalizeKindMap<TItem, TId extends ItemId>(
  kindMap: CollectionDefinition<TItem, TId>['kindMap']
): Record<string, AnyRowKindDefinition<TItem, TId>> {
  const normalized = { ...kindMap } as Record<string, AnyRowKindDefinition<TItem, TId>>;

  if (!normalized.separator) {
    normalized.separator = new RowKindSeparatorDefinition<TItem, TId>();
  }

  if (!normalized.default) {
    const fallbackKind = Object.keys(normalized).find((kind) => kind !== 'separator') ?? 'separator';
    normalized.default = normalized[fallbackKind];
  }

  return normalized;
}

export function defineCollection<TItem, TId extends ItemId = string>(
  def: CollectionDefinition<TItem, TId>
): CollectionConfig<TItem, TId> {
  const kindMap = normalizeKindMap(def.kindMap);

  return {
    ...def,
    kindMap,
    getItemKind: def.getItemKind ?? (() => 'default'),
    capabilities: normalizeCapabilities(def.capabilities),
    defaultKind: 'default',
  };
}
