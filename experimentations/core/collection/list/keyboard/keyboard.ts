// Re-export base types from shared
export type { KeyboardStrategy } from '@/core/collection/shared/keyboard';
export {
  getFirstFocusableId, getLastFocusableId, getNextFocusableId, getPrevFocusableId,
} from '@/core/collection/shared/keyboard';

// KeyboardOverrides is list-specific and defined here.
import type { CollectionCapabilities } from '@/core/collection/shared/definition/types';
import type { CollectionIntent } from '@/core/collection/shared/intents/types';

export type KeyboardOverrides =
  Partial<Record<string, (e: KeyboardEvent, capabilities?: CollectionCapabilities) => CollectionIntent | null>>;


