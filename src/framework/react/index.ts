/**
 * @forge/react — the React adapter.
 *
 * Bridges the pure core (machines, behaviors, effects, virtualizer, shortcut
 * manager) to React + DOM. Nothing here contains component logic: it renders
 * state, dispatches intents, and interprets effects. A Vue/Svelte/SolidJS
 * adapter would reimplement only this layer.
 */

export {
  useMachine,
  useComposedMachine,
  useLiveRef,
  type MachineHandle,
  type ComposedHandle,
} from "./useMachine";

export {
  useForgeEffects,
  createItemRegistry,
  announceNow,
  pushFocusRestore,
  type ItemRegistry,
  type EffectInterpreter,
  type EventHandlers,
  type UseForgeEffectsOptions,
} from "./effects";

export { useKeymap, resolveBinding, strokeFromEvent, detectPlatform } from "./useKeymap";

export {
  useVirtualizer,
  type UseVirtualizerOptions,
  type VirtualizerHandle,
} from "./useVirtualizer";

export {
  ShortcutProvider,
  ShortcutScope,
  useShortcut,
  useShortcutManager,
  type ShortcutScopeProps,
  type UseShortcutOptions,
} from "./shortcuts";

export { Overlay, type OverlayProps } from "./overlay";

export { useDataSource, type UseDataSourceResult } from "./useDataSource";
