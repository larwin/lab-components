import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  angleForValue,
  collectionFromArray,
  composeMachine,
  dayPeriodLabels,
  dayPeriodOf,
  dayPeriodOptions,
  dialHourFromPoint,
  dialMinuteFromPoint,
  dismissable,
  dismissIntents,
  displayHour,
  focusable,
  focusIntents,
  formatNumber,
  formatTime,
  hourAngle,
  hourCycleOf,
  hourFromDisplay,
  hourOnInnerRing,
  hourOptions,
  minuteAngle,
  minuteOptions,
  navigable,
  navIntents,
  nearestEnabledOption,
  numberIntents,
  numericValue,
  selectable,
  selectIntents,
  timeUnitLabel,
  usesDayPeriod,
  wheelIndexForOffset,
  wheelSettle,
  type Collection,
  type CollectionBehaviorConfig,
  type DismissableSlice,
  type DismissReason,
  type HourCycle,
  type Key,
  type NavigableSlice,
  type NumericValueSlice,
  type SelectableSlice,
  type TimeOption,
  type TimePickerOptionsConfig,
  type TimeValue,
} from "@/framework/core";
import {
  createItemRegistry,
  Overlay,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
} from "@/framework/react";
import { TimeField } from "./TimeField";

/**
 * TimePicker — ONE state, FOUR shells. The proof of "a machine, N renders":
 * every variant binds the same TimeValue and reuses existing machines —
 * `segments` is the TimeField (generic segment machine), `columns` and
 * `wheel` are the listbox composition [Focusable+Navigable+Selectable] per
 * column (typeahead included; the wheel adds selectionFollowsFocus so arrows
 * rotate it), `dial` is the NumericValue machine on the slider profile
 * (pointer geometry and arrows converge on the same `number/set` intent, the
 * Slider pattern). No new reducer anywhere: what differs per variant is pure
 * Node-tested geometry from core/time/picker (option policies, wheel snap +
 * inertia, dial angle ↔ value with two rings and step magnetism).
 *
 * `variant` is a prop, not four primitives: the props contract and behavior
 * are identical — only the projection changes (see RFC-001 table).
 */

export type TimePickerVariant = "segments" | "columns" | "wheel" | "dial";

const pickerBehaviors = [dismissable] as const;

export interface TimePickerProps {
  variant?: TimePickerVariant;
  value?: TimeValue | null;
  defaultValue?: TimeValue;
  onValueChange?: (time: TimeValue | null) => void;
  locale?: string;
  /** Minute granularity for columns/wheel lists and dial magnetism (1/5/15…). */
  minuteStep?: number;
  min?: TimeValue;
  max?: TimeValue;
  isTimeDisabled?: (time: TimeValue) => boolean;
  disabled?: boolean;
  name?: string;
  /** Trigger button label (SR). Default French. */
  triggerLabel?: string;
  className?: string;
  "aria-label"?: string;
}

export function TimePicker({
  variant = "segments",
  value,
  defaultValue,
  onValueChange,
  locale = "fr",
  minuteStep = 1,
  min,
  max,
  isTimeDisabled,
  disabled = false,
  name,
  triggerLabel = "Choisir l'heure",
  className,
  ...rest
}: TimePickerProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const live = useLiveRef({ onValueChange, minuteStep, min, max, isTimeDisabled });
  const cycle = useMemo(() => hourCycleOf(locale), [locale]);
  const periods = useMemo(() => dayPeriodLabels(locale), [locale]);

  // Uncontrolled fallback: the picker owns the value when no `value` prop.
  const [inner, setInner] = useState<TimeValue | null>(defaultValue ?? null);
  const current = value !== undefined ? value : inner;
  const setValue = (time: TimeValue | null) => {
    if (value === undefined) setInner(time);
    live.current.onValueChange?.(time);
  };

  const optionsConfig: TimePickerOptionsConfig = {
    hourCycle: cycle,
    minuteStep: live.current.minuteStep,
    min: live.current.min,
    max: live.current.max,
    isTimeDisabled: live.current.isTimeDisabled,
  };

  /**
   * Per-unit commit: picking one unit completes the others from the current
   * value, defaulting a missing half to its first enabled option (picking an
   * hour first yields a full, valid TimeValue immediately — the
   * DateTimePicker-midnight rule, bounds-aware).
   */
  const commit = (part: { hour?: number; minute?: number; dayPeriod?: 0 | 1 }) => {
    const dp = part.dayPeriod ?? (current ? dayPeriodOf(current.hour) : 0);
    let hour = part.hour ?? current?.hour;
    if (part.dayPeriod !== undefined && part.hour === undefined && current) {
      hour = hourFromDisplay(displayHour(current.hour, cycle), part.dayPeriod, cycle);
    }
    if (hour === undefined) {
      const options = hourOptions(optionsConfig, dp);
      const seed = options.find((o) => !o.disabled) ?? options[0];
      hour = hourFromDisplay(seed.value, dp, cycle);
    }
    let minute = part.minute ?? current?.minute;
    if (minute === undefined) {
      const options = minuteOptions(optionsConfig, hour);
      minute = (options.find((o) => !o.disabled) ?? options[0]).value;
    }
    setValue({ hour, minute });
  };

  const { state, dispatch, store } = useComposedMachine(() =>
    composeMachine("timepicker", pickerBehaviors, {}),
  );
  const open = (state.dismissable as DismissableSlice).open;
  useForgeEffects(store, {});

  const field = (
    <TimeField
      value={current}
      onValueChange={setValue}
      locale={locale}
      disabled={disabled}
      name={name}
      aria-label={rest["aria-label"]}
    />
  );

  if (variant === "segments") {
    return (
      <div ref={anchorRef} className={cn("inline-flex items-center gap-1", className)}>
        {field}
      </div>
    );
  }

  const panel =
    variant === "columns" ? (
      <ColumnsPanel
        value={current}
        commit={commit}
        cycle={cycle}
        periods={periods}
        config={optionsConfig}
        locale={locale}
      />
    ) : variant === "wheel" ? (
      <WheelPanel
        value={current}
        commit={commit}
        cycle={cycle}
        periods={periods}
        config={optionsConfig}
        locale={locale}
      />
    ) : (
      <DialPanel
        value={current}
        commit={commit}
        cycle={cycle}
        periods={periods}
        config={optionsConfig}
        locale={locale}
      />
    );

  return (
    <div ref={anchorRef} className={cn("inline-flex items-center gap-1", className)}>
      {field}
      <button
        type="button"
        disabled={disabled}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() =>
          dispatch(
            open
              ? dismissIntents.close(undefined, "pointer")
              : dismissIntents.open(undefined, "pointer"),
          )
        }
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors outline-none",
          "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          open && "bg-muted text-foreground",
        )}
      >
        <Clock className="size-4" />
      </button>

      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={anchorRef}
        placement="bottom-start"
        offset={4}
      >
        <div
          role="dialog"
          aria-label={triggerLabel}
          data-autofocus
          tabIndex={-1}
          className="rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
        >
          {panel}
        </div>
      </Overlay>
    </div>
  );
}

/* ------------------------------ shared pieces ------------------------------ */

interface PanelProps {
  value: TimeValue | null;
  commit: (part: { hour?: number; minute?: number; dayPeriod?: 0 | 1 }) => void;
  cycle: HourCycle;
  periods: readonly [string, string];
  config: TimePickerOptionsConfig;
  locale: string;
}

const pad2 = (value: number, locale: string) =>
  formatNumber(value, locale, { minimumIntegerDigits: 2, useGrouping: false });

/** The hour column/wheel/dial values, as display hours with disabled flags. */
const useUnitOptions = (props: PanelProps) => {
  const dp: 0 | 1 = props.value ? dayPeriodOf(props.value.hour) : 0;
  return {
    dp,
    hours: hourOptions(props.config, dp),
    minutes: minuteOptions(props.config, props.value?.hour ?? null),
    dayPeriods: dayPeriodOptions(props.config),
    selectedHour: props.value !== null ? displayHour(props.value.hour, props.cycle) : null,
    selectedMinute: props.value?.minute ?? null,
  };
};

const columnBehaviors = [focusable, navigable, selectable] as const;

/**
 * One listbox column — the very same machine composition as Listbox/Select
 * (typeahead included). `followFocus` turns it into a wheel: arrows move
 * focus, the selection follows, the shell only renders the offset.
 */
function useColumnMachine(args: {
  options: readonly TimeOption[];
  format: (value: number) => string;
  selected: number | null;
  onPick: (value: number) => void;
  followFocus: boolean;
}) {
  const live = useLiveRef(args);
  const { options, format } = args;
  const collection = useMemo(
    () =>
      collectionFromArray(options as TimeOption[], {
        getKey: (o) => String(o.value),
        getTextValue: (o) => format(o.value),
        isDisabled: (o) => o.disabled,
      }),
    [options, format],
  );
  const collectionRef = useLiveRef(collection);
  const [registry] = useState(createItemRegistry);

  const { state, dispatch, store, composed } = useComposedMachine(() => {
    const config: CollectionBehaviorConfig = {
      getCollection: () => collectionRef.current as Collection<unknown>,
      selectionMode: "single",
      wrap: true,
      get selectionFollowsFocus() {
        return live.current.followFocus;
      },
      defaultSelectedKeys:
        live.current.selected !== null ? [String(live.current.selected)] : undefined,
    };
    return composeMachine("timepicker-column", columnBehaviors, config);
  });

  const nav = state.navigable as NavigableSlice;
  const selection = state.selectable as SelectableSlice;
  const selectedKey = [...selection.selectedKeys][0] ?? null;

  // Controlled sync — the picker's TimeValue is the source of truth.
  useEffect(() => {
    const expected = live.current.selected !== null ? String(live.current.selected) : null;
    if (expected !== null && expected !== selectedKey) {
      dispatch(selectIntents.select({ key: expected }, "program"));
      dispatch(navIntents.move({ key: expected }, "program"));
    }
  }, [live, args.selected, selectedKey, dispatch]);

  useForgeEffects(store, {
    registry,
    events: {
      selectionChange: (detail) => {
        const key = [...(detail as { selectedKeys: ReadonlySet<Key> }).selectedKeys][0];
        if (key !== undefined) live.current.onPick(Number(key));
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  return { nav, selectedKey, dispatch, registry, onKeyDown };
}

/* --------------------------------- columns --------------------------------- */

function ListColumn(props: {
  options: readonly TimeOption[];
  format: (value: number) => string;
  selected: number | null;
  onPick: (value: number) => void;
  ariaLabel: string;
}) {
  const baseId = useId();
  const { nav, selectedKey, dispatch, registry, onKeyDown } = useColumnMachine({
    ...props,
    followFocus: false,
  });
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Open with the selected option visible.
  useEffect(() => {
    if (selectedKey !== null) {
      registry.get(selectedKey)?.scrollIntoView?.({ block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const domId = (key: Key) => `${baseId}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <div
      ref={hostRef}
      role="listbox"
      tabIndex={0}
      aria-label={props.ariaLabel}
      aria-activedescendant={nav.focusedKey !== null ? domId(nav.focusedKey) : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      className="max-h-56 w-16 overflow-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {props.options.map((option) => {
        const key = String(option.value);
        const selected = selectedKey === key;
        const focused = nav.focusedKey === key;
        return (
          <div
            key={key}
            id={domId(key)}
            ref={registry.register(key)}
            role="option"
            aria-selected={selected}
            aria-disabled={option.disabled || undefined}
            data-focused={focused || undefined}
            onPointerEnter={() => !option.disabled && dispatch(navIntents.move({ key }, "pointer"))}
            onClick={() => !option.disabled && dispatch(selectIntents.select({ key }, "pointer"))}
            className={cn(
              "cursor-default rounded px-2 py-1 text-center font-mono text-sm tabular-nums",
              focused && "ring-2 ring-ring ring-inset",
              selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              option.disabled && "opacity-40",
            )}
          >
            {props.format(option.value)}
          </div>
        );
      })}
    </div>
  );
}

function ColumnsPanel(props: PanelProps) {
  const { dp, hours, minutes, dayPeriods, selectedHour, selectedMinute } = useUnitOptions(props);
  const { commit, cycle, periods, locale } = props;
  const padHour = !usesDayPeriod(cycle);
  return (
    <div className="flex gap-1">
      <ListColumn
        options={hours}
        format={(v) => (padHour ? pad2(v, locale) : formatNumber(v, locale))}
        selected={selectedHour}
        onPick={(display) => commit({ hour: hourFromDisplay(display, dp, cycle) })}
        ariaLabel={timeUnitLabel("hour", locale)}
      />
      <ListColumn
        options={minutes}
        format={(v) => pad2(v, locale)}
        selected={selectedMinute}
        onPick={(minute) => commit({ minute })}
        ariaLabel={timeUnitLabel("minute", locale)}
      />
      {dayPeriods.length > 0 && (
        <ListColumn
          options={dayPeriods}
          format={(v) => periods[v === 1 ? 1 : 0]}
          selected={props.value ? dp : null}
          onPick={(period) => commit({ dayPeriod: period === 1 ? 1 : 0 })}
          ariaLabel={timeUnitLabel("dayPeriod", locale)}
        />
      )}
    </div>
  );
}

/* ---------------------------------- wheel ---------------------------------- */

const WHEEL_ITEM = 32;
const WHEEL_VISIBLE = 5;

function WheelColumn(props: {
  options: readonly TimeOption[];
  format: (value: number) => string;
  selected: number | null;
  onPick: (value: number) => void;
  ariaLabel: string;
}) {
  const baseId = useId();
  const { nav, selectedKey, dispatch, onKeyDown } = useColumnMachine({
    ...props,
    followFocus: true,
  });
  const domId = (key: Key) => `${baseId}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const [dragDelta, setDragDelta] = useState<number | null>(null);
  const pointer = useRef({ startY: 0, lastY: 0, lastT: 0, velocity: 0 });

  const selectedIndex = Math.max(
    0,
    props.options.findIndex((o) => String(o.value) === selectedKey),
  );
  const baseOffset = selectedIndex * WHEEL_ITEM;
  const offset = baseOffset - (dragDelta ?? 0);
  const centerPad = (WHEEL_VISIBLE - 1) / 2;

  const settle = (velocity: number) => {
    const settled = wheelSettle(offset, -velocity, WHEEL_ITEM, props.options.length);
    const index = nearestEnabledOption(props.options, settled.index);
    setDragDelta(null);
    if (index !== null) {
      const key = String(props.options[index].value);
      dispatch(navIntents.move({ key }, "pointer"));
      dispatch(selectIntents.select({ key }, "pointer"));
    }
  };

  return (
    <div
      role="listbox"
      tabIndex={0}
      aria-label={props.ariaLabel}
      aria-activedescendant={nav.focusedKey !== null ? domId(nav.focusedKey) : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
        setDragDelta(0);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId) || dragDelta === null) return;
        const dt = Math.max(1, e.timeStamp - pointer.current.lastT);
        pointer.current.velocity = (e.clientY - pointer.current.lastY) / dt;
        pointer.current.lastY = e.clientY;
        pointer.current.lastT = e.timeStamp;
        setDragDelta(e.clientY - pointer.current.startY);
      }}
      onPointerUp={() => dragDelta !== null && settle(pointer.current.velocity)}
      onPointerCancel={() => setDragDelta(null)}
      onWheel={(e) => {
        const settled = wheelIndexForOffset(
          baseOffset + Math.sign(e.deltaY) * WHEEL_ITEM,
          WHEEL_ITEM,
          props.options.length,
        );
        const index = nearestEnabledOption(props.options, settled);
        if (index !== null) {
          const key = String(props.options[index].value);
          dispatch(navIntents.move({ key }, "pointer"));
          dispatch(selectIntents.select({ key }, "pointer"));
        }
      }}
      className="relative w-16 touch-none overflow-hidden rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ height: WHEEL_ITEM * WHEEL_VISIBLE }}
    >
      {/* selection lens */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 rounded bg-accent/40"
        style={{ top: centerPad * WHEEL_ITEM, height: WHEEL_ITEM }}
      />
      <div
        className={cn("will-change-transform", dragDelta === null && "transition-transform")}
        style={{ transform: `translateY(${centerPad * WHEEL_ITEM - offset}px)` }}
      >
        {props.options.map((option) => {
          const key = String(option.value);
          const selected = selectedKey === key;
          const focused = nav.focusedKey === key;
          return (
            <div
              key={key}
              id={domId(key)}
              role="option"
              aria-selected={selected}
              aria-disabled={option.disabled || undefined}
              data-focused={focused || undefined}
              className={cn(
                "flex items-center justify-center font-mono text-sm tabular-nums",
                selected ? "text-foreground" : "text-muted-foreground/70",
                option.disabled && "opacity-40 line-through",
              )}
              style={{ height: WHEEL_ITEM }}
            >
              {props.format(option.value)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WheelPanel(props: PanelProps) {
  const { dp, hours, minutes, dayPeriods, selectedHour, selectedMinute } = useUnitOptions(props);
  const { commit, cycle, periods, locale } = props;
  const padHour = !usesDayPeriod(cycle);
  return (
    <div className="flex gap-1">
      <WheelColumn
        options={hours}
        format={(v) => (padHour ? pad2(v, locale) : formatNumber(v, locale))}
        selected={selectedHour}
        onPick={(display) => commit({ hour: hourFromDisplay(display, dp, cycle) })}
        ariaLabel={timeUnitLabel("hour", locale)}
      />
      <WheelColumn
        options={minutes}
        format={(v) => pad2(v, locale)}
        selected={selectedMinute}
        onPick={(minute) => commit({ minute })}
        ariaLabel={timeUnitLabel("minute", locale)}
      />
      {dayPeriods.length > 0 && (
        <WheelColumn
          options={dayPeriods}
          format={(v) => periods[v === 1 ? 1 : 0]}
          selected={props.value ? dp : null}
          onPick={(period) => commit({ dayPeriod: period === 1 ? 1 : 0 })}
          ariaLabel={timeUnitLabel("dayPeriod", locale)}
        />
      )}
    </div>
  );
}

/* ----------------------------------- dial ---------------------------------- */

const DIAL_SIZE = 224;
const DIAL_RADIUS = DIAL_SIZE / 2;
const OUTER_R = 92;
const INNER_R = 58;

const dialBehaviors = [focusable, numericValue] as const;

function DialPanel(props: PanelProps) {
  const { commit, cycle, periods, locale } = props;
  const { dp, hours, minutes } = useUnitOptions(props);
  const [unit, setUnit] = useState<"hour" | "minute">("hour");
  const live = useLiveRef({ ...props, unit, dp });
  const faceRef = useRef<HTMLDivElement | null>(null);

  // The Slider pattern: ONE NumericValue machine; pointer geometry and arrow
  // keys converge on the same `number/set` / increment intents. The active
  // unit only changes the live-read bounds/step — never the machine.
  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("timepicker-dial", dialBehaviors, {
      min: 0,
      get max() {
        return live.current.unit === "hour" ? 23 : 59;
      },
      get step() {
        return live.current.unit === "hour" ? 1 : Math.max(1, live.current.config.minuteStep ?? 1);
      },
      defaultValue: 0,
      keys: "slider" as const,
      getValueText: (v: number) =>
        live.current.unit === "hour"
          ? formatTime({ hour: v, minute: live.current.value?.minute ?? 0 }, live.current.locale)
          : pad2(v, live.current.locale),
    } as never),
  );
  const machineValue = (state.numeric as NumericValueSlice).value ?? 0;

  // Controlled sync: the dial shows the picker's value for the active unit.
  const target =
    props.value === null ? null : unit === "hour" ? props.value.hour : props.value.minute;
  useEffect(() => {
    if (target !== null && target !== machineValue) {
      dispatch(numberIntents.set({ value: target }, "program"));
    }
  }, [target, machineValue, dispatch]);

  // Event handlers are captured once by the effect interpreter — read
  // everything through the live ref (the controlled/non-controlled rule).
  const isEnabledLive = (v: number): boolean => {
    const snapshot = live.current;
    return snapshot.unit === "hour"
      ? !(
          hourOptions(snapshot.config, snapshot.dp).find(
            (o) => o.value === displayHour(v, snapshot.cycle),
          )?.disabled ?? false
        )
      : !(
          minuteOptions(snapshot.config, snapshot.value?.hour ?? null).find((o) => o.value === v)
            ?.disabled ?? false
        );
  };

  useForgeEffects(store, {
    events: {
      change: (detail) => {
        const v = (detail as { value: number | null }).value;
        if (v === null || !isEnabledLive(v)) return;
        live.current.commit(live.current.unit === "hour" ? { hour: v } : { minute: v });
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(store.getState()), dispatch);

  const dispatchPointer = (clientX: number, clientY: number, release: boolean) => {
    const rect = faceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const ratio = Math.hypot(dx, dy) / DIAL_RADIUS;
    const v =
      live.current.unit === "hour"
        ? dialHourFromPoint(dx, dy, ratio, cycle, live.current.dp)
        : dialMinuteFromPoint(dx, dy, live.current.config.minuteStep ?? 1);
    if (isEnabledLive(v)) dispatch(numberIntents.set({ value: v }, "pointer"));
    // Material flow: confirming the hour hands over to the minute dial.
    if (release && live.current.unit === "hour") setUnit("minute");
  };

  const angle = unit === "hour" ? hourAngle(machineValue) : minuteAngle(machineValue);
  const handLength =
    unit === "hour" && hourOnInnerRing(machineValue, cycle) ? INNER_R : OUTER_R - 14;

  const numberAt = (
    displayValue: number,
    count: number,
    radius: number,
    label: string,
    disabled: boolean,
    selected: boolean,
  ) => {
    const a = (angleForValue(displayValue, count) * Math.PI) / 180;
    const x = DIAL_RADIUS + radius * Math.sin(a);
    const y = DIAL_RADIUS - radius * Math.cos(a);
    return (
      <span
        key={`${radius}-${displayValue}`}
        aria-hidden
        className={cn(
          "absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-xs tabular-nums",
          selected && "bg-primary text-primary-foreground",
          !selected && disabled && "text-muted-foreground/40 line-through",
          !selected && !disabled && "text-foreground",
        )}
        style={{ left: x, top: y }}
      >
        {label}
      </span>
    );
  };

  const hourNumbers = hours.map((o) => {
    const storage = hourFromDisplay(o.value, dp, cycle);
    const inner = hourOnInnerRing(storage, cycle);
    return numberAt(
      o.value % 12,
      12,
      inner ? INNER_R : OUTER_R,
      usesDayPeriod(cycle)
        ? formatNumber(o.value, locale)
        : pad2(o.value === 24 ? 0 : o.value, locale),
      o.disabled,
      unit === "hour" && props.value !== null && storage === props.value.hour,
    );
  });

  const minuteNumbers = minutes
    .filter((o) => o.value % 5 === 0 || (props.config.minuteStep ?? 1) >= 5)
    .map((o) =>
      numberAt(
        o.value,
        60,
        OUTER_R,
        pad2(o.value, locale),
        o.disabled,
        unit === "minute" && props.value !== null && o.value === props.value.minute,
      ),
    );

  return (
    <div className="flex flex-col items-center gap-2">
      {/* unit switch — presentation state only; values live in the machine */}
      <div className="flex items-center gap-1 font-mono text-lg tabular-nums">
        <button
          type="button"
          aria-pressed={unit === "hour"}
          onClick={() => setUnit("hour")}
          className={cn(
            "rounded px-1.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            unit === "hour" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
          )}
        >
          {props.value ? pad2(displayHour(props.value.hour, cycle), locale) : "––"}
        </button>
        <span className="text-muted-foreground">:</span>
        <button
          type="button"
          aria-pressed={unit === "minute"}
          onClick={() => setUnit("minute")}
          className={cn(
            "rounded px-1.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            unit === "minute" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
          )}
        >
          {props.value ? pad2(props.value.minute, locale) : "––"}
        </button>
        {usesDayPeriod(cycle) && (
          <button
            type="button"
            onClick={() => commit({ dayPeriod: dp === 1 ? 0 : 1 })}
            className="ml-1 rounded px-1.5 py-0.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {props.value ? periods[dp] : periods.join("/")}
          </button>
        )}
      </div>

      <div
        ref={faceRef}
        role="slider"
        tabIndex={0}
        {...composed.aria(state)}
        aria-label={timeUnitLabel(unit, locale)}
        onKeyDown={onKeyDown}
        onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
        onBlur={() => dispatch(focusIntents.blur(undefined))}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dispatchPointer(e.clientX, e.clientY, false);
          e.currentTarget.focus();
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId) && e.buttons > 0) {
            dispatchPointer(e.clientX, e.clientY, false);
          }
        }}
        onPointerUp={(e) => dispatchPointer(e.clientX, e.clientY, true)}
        className="relative touch-none rounded-full bg-muted outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ width: DIAL_SIZE, height: DIAL_SIZE }}
      >
        {/* hand */}
        <div
          aria-hidden
          className="absolute left-1/2 origin-bottom"
          style={{
            top: DIAL_RADIUS - handLength,
            height: handLength,
            width: 2,
            transform: `translateX(-50%) rotate(${angle}deg)`,
            transformOrigin: `50% ${handLength}px`,
          }}
        >
          <div className="h-full w-full bg-primary" />
          <div className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-primary" />
        </div>
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        />
        {unit === "hour" ? hourNumbers : minuteNumbers}
      </div>
    </div>
  );
}
