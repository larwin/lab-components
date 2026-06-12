/**
 * @forge/core — the pure heart of the framework.
 *
 * HARD RULE: nothing in src/framework/core imports React, the DOM, or any
 * rendering framework. Everything here is deterministic, serializable-friendly
 * and unit-testable in plain Node. React lives in src/framework/react as one
 * possible adapter among others.
 *
 *   Intent → Reducer/Machine → State → Effects (declarative) → Adapter
 */

// Runtime
export {
  defineIntent,
  type Intent,
  type IntentFactory,
  type InteractionSource,
} from "./runtime/intent";
export {
  defineEffect,
  focusElement,
  scrollToItem,
  announce,
  restoreFocus,
  emitEvent,
  loadData,
  type Effect,
  type EffectFactory,
} from "./runtime/effect";
export {
  createMachine,
  withEffects,
  toTransition,
  type Machine,
  type MachineConfig,
  type Transition,
  type TransitionResult,
  type IntentHandler,
} from "./runtime/machine";
export {
  createStore,
  inspect,
  type Store,
  type StoreOptions,
  type TransitionRecord,
  type EffectHandler,
} from "./runtime/store";

// Behaviors
export {
  defineBehavior,
  composeMachine,
  type Behavior,
  type BehaviorContext,
  type ComposedMachine,
  type ComposedState,
  type ComposedConfig,
  type KeyBinding,
  type AriaProps,
} from "./behaviors/behavior";
export {
  focusable,
  focusIntents,
  type FocusableSlice,
  type FocusableConfig,
} from "./behaviors/focusable";
export { pressable, pressIntents, type PressableSlice } from "./behaviors/pressable";
export {
  toggleable,
  toggleIntents,
  type ToggleableSlice,
  type ToggleableConfig,
  type CheckedState,
} from "./behaviors/toggleable";
export { navigable, navIntents, type NavigableSlice } from "./behaviors/navigable";
export { selectable, selectIntents, type SelectableSlice } from "./behaviors/selectable";
export {
  expandable,
  expandIntents,
  type ExpandableSlice,
  type ExpandableConfig,
} from "./behaviors/expandable";
export {
  dismissable,
  dismissIntents,
  type DismissableSlice,
  type DismissableConfig,
  type DismissReason,
} from "./behaviors/dismissable";
export {
  searchable,
  searchIntents,
  type SearchableSlice,
  type SearchableConfig,
} from "./behaviors/searchable";
export { actionable, actionIntents } from "./behaviors/actionable";
export {
  validatable,
  validityIntents,
  type ValidatableSlice,
  type ValidatableConfig,
  type Validator,
  type FieldValueReader,
} from "./behaviors/validatable";
export {
  numericValue,
  numberIntents,
  type NumericValueSlice,
  type NumericValueConfig,
} from "./behaviors/numeric-value";
export { visibleKeysOf, type CollectionBehaviorConfig } from "./behaviors/collection-config";

// Collection engine
export {
  createCollection,
  collectionFromArray,
  type Collection,
  type CollectionNode,
  type CollectionSourceNode,
  type Key,
  type NodeKind,
} from "./collection/collection";
export {
  firstKey,
  lastKey,
  nextKey,
  previousKey,
  pageKey,
  keysBetween,
  type NavigateOptions,
} from "./collection/navigation";
export {
  applySelect,
  selectAll,
  clearSelection,
  EMPTY_SELECTION,
  type SelectionMode,
  type SelectionSnapshot,
} from "./collection/selection";
export {
  typeaheadStep,
  createSearchCollator,
  EMPTY_TYPEAHEAD,
  TYPEAHEAD_TIMEOUT_MS,
  type TypeaheadState,
  type TypeaheadResult,
} from "./collection/typeahead";

// Interaction
export {
  parseKeyCombo,
  matchesCombo,
  formatKeyCombo,
  isPrintableStroke,
  type KeyStroke,
  type KeyCombo,
  type Platform,
} from "./interaction/keys";
export { resolveBinding } from "./interaction/keymap";
export {
  createShortcutManager,
  ROOT_SCOPE,
  type ShortcutManager,
  type ShortcutBinding,
  type ShortcutScope,
  type RegisterOptions,
  type ConflictReport,
} from "./interaction/shortcuts";

// Data
export {
  sortRows,
  filterRows,
  toggleSort,
  type SortSpec,
  type SortDirection,
  type FieldAccessor,
} from "./data/query";
export {
  buildGroups,
  flattenGroups,
  type GroupNode,
  type DisplayRow,
  type AggregateSpec,
  type AggregateFn,
} from "./data/grouping";
export {
  arraySource,
  type DataSource,
  type DataQuery,
  type DataPage,
  type ArraySourceOptions,
} from "./data/source";
export {
  createPaginationMachine,
  paginationIntents,
  paginationRange,
  pageCountOf,
  type PaginationState,
  type PaginationConfig,
  type PaginationRangeItem,
} from "./data/pagination";
export {
  createLoaderMachine,
  loadIntents,
  fetchEffect,
  cancelEffect,
  type LoaderState,
  type LoaderConfig,
  type LoaderQueryState,
} from "./data/loader";

// Drag & drop
export {
  createDragMachine,
  dragIntents,
  type DragState,
  type DragConfig,
  type DragActive,
  type DragLocation,
  type DragMoveDetail,
} from "./dnd/dragMachine";

// Toast queue
export {
  createToastMachine,
  toastIntents,
  scheduleDismiss,
  cancelDismiss,
  type ToastState,
  type ToastItem,
  type ToastKind,
  type ToastConfig,
  type EnqueueToastPayload,
} from "./overlay/toast";

// Text input machines
export { characterLimit, type CharacterLimitState } from "./text/character-limit";
export {
  createPinMachine,
  pinIntents,
  pinKeymap,
  sanitizePinText,
  type PinState,
  type PinConfig,
  type PinKind,
} from "./text/pin";

// Dates
export {
  dateValue,
  isLeapYear,
  daysInMonth,
  toEpochDays,
  fromEpochDays,
  dayOfWeek,
  addDays,
  addMonths,
  addYears,
  compareDates,
  isSameDay,
  isSameMonth,
  clampDate,
  isDateInRange,
  isBetween,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  toISODate,
  parseISODate,
  monthGrid,
  type DateValue,
  type CalendarCell,
} from "./date/value";
export {
  firstDayOfWeek,
  weekdayNames,
  monthNames,
  formatDate,
  formatMonthYear,
  dateFieldParts,
  dateUnitLabel,
  type DateSegmentType,
  type DateFieldPart,
} from "./date/intl";
export {
  createCalendarMachine,
  calendarIntents,
  calendarKeymap,
  calendarRange,
  type CalendarState,
  type CalendarConfig,
  type DateRange,
} from "./date/calendar";
export {
  createDateFieldMachine,
  dateFieldIntents,
  dateFieldKeymap,
  dateFieldValue,
  dateSegmentAria,
  dateSegmentValues,
  normalizeDigit,
  type DateFieldState,
  type DateFieldConfig,
} from "./date/field";

// Segment fields (the generic machine behind dateField & timeField)
export {
  createSegmentFieldMachine,
  segmentFieldIntents,
  segmentFieldKeymap,
  segmentAria,
  type SegmentFieldState,
  type SegmentFieldConfig,
  type SegmentSpec,
  type SegmentValues,
} from "./field/segments";

// Times
export {
  timeValue,
  toSecondsOfDay,
  fromSecondsOfDay,
  addMinutes,
  addHours,
  addSeconds,
  compareTimes,
  isSameTime,
  clampTime,
  isTimeInRange,
  roundToMinuteStep,
  toISOTime,
  parseISOTime,
  usesDayPeriod,
  hourBounds,
  dayPeriodOf,
  displayHour,
  hourFromDisplay,
  combineDateTime,
  dateOf,
  timeOf,
  compareDateTimes,
  isSameDateTime,
  addDateTimeMinutes,
  toISODateTime,
  SECONDS_PER_DAY,
  type TimeValue,
  type DateTimeValue,
  type HourCycle,
} from "./time/value";
export {
  hourCycleOf,
  formatTime,
  timeFieldParts,
  dayPeriodLabels,
  timeUnitLabel,
  type TimeSegmentType,
  type TimeFieldPart,
} from "./time/intl";
export {
  createTimeFieldMachine,
  timeFieldKeymap,
  timeFieldValue,
  timeSegmentValues,
  timeSegmentAria,
  timeSegmentSpecs,
  dayPeriodParser,
  type TimeFieldConfig,
} from "./time/field";
export {
  minuteSteps,
  hourOptions,
  minuteOptions,
  dayPeriodOptions,
  nearestEnabledOption,
  wheelIndexForOffset,
  wheelOffsetForIndex,
  wheelSettle,
  pointToAngle,
  angleForValue,
  snapAngleToValues,
  minuteAngle,
  hourAngle,
  dialMinuteFromPoint,
  dialHourFromPoint,
  hourOnInnerRing,
  DIAL_INNER_RING_RATIO,
  type TimePickerOptionsConfig,
  type TimeOption,
} from "./time/picker";
// NOTE: ./time/windows-zones (CLDR Windows ↔ IANA mapping) is deliberately
// NOT re-exported here — it is an optional leaf module; import it directly
// so consumers who don't need it never ship it.
export {
  zoneOffset,
  zonedFromInstant,
  instantFromZoned,
  zonedDateTime,
  epochOf,
  withTimeZone,
  addZonedDays,
  addZonedMinutes,
  supportedTimeZones,
  timeZoneCity,
  timeZoneName,
  formatOffset,
  formatZoned,
  type ZonedDateTime,
  type TimeZoneNameStyle,
} from "./time/zone";

// Overlay positioning
export {
  computePosition,
  type Placement,
  type PositionInput,
  type PositionResult,
  type Rect,
  type Side,
  type Align,
} from "./overlay/positioning";

// Virtualization
export {
  createVirtualizer,
  type Virtualizer,
  type VirtualizerOptions,
  type VirtualItem,
  type VirtualRange,
} from "./virtualization/virtualizer";

// i18n
export {
  createTranslator,
  createSortCollator,
  getTextDirection,
  type Translator,
  type MessageBundle,
  type MessageValues,
} from "./i18n";
export { formatNumber, parseNumber, type NumberFormatSpec } from "./i18n/number";
