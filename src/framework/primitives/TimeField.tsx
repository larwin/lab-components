import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  createTimeFieldMachine,
  dayPeriodLabels,
  formatNumber,
  getTextDirection,
  hourCycleOf,
  isSameTime,
  segmentFieldIntents,
  timeFieldKeymap,
  timeFieldParts,
  timeFieldValue,
  timeSegmentAria,
  timeSegmentValues,
  timeUnitLabel,
  toISOTime,
  type SegmentFieldState,
  type TimeFieldConfig,
  type TimeSegmentType,
  type TimeValue,
} from "@/framework/core";
import {
  createItemRegistry,
  useForgeEffects,
  useKeymap,
  useLiveRef,
  useMachine,
} from "@/framework/react";

/**
 * TimeField — segmented hour/minute(/second/AM-PM) input in locale order
 * (Intl formatToParts decides "2:08 PM" vs "14:08" and the separators; the
 * hour cycle comes from Intl, never guessed). Same generic segment machine as
 * DateField: digits type with auto-advance, arrows step with wrap, the
 * dayPeriod segment toggles with arrows or the localized "a"/"p" initial.
 * Storage is always 0-23 — only the display follows the locale's cycle.
 */

export interface TimeFieldProps {
  value?: TimeValue | null;
  defaultValue?: TimeValue;
  onValueChange?: (time: TimeValue | null) => void;
  locale?: string;
  /** Seconds are opt-in. */
  showSeconds?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
  "aria-label"?: string;
}

const SEGMENT_WIDTH: Record<TimeSegmentType, number> = {
  hour: 2,
  minute: 2,
  second: 2,
  dayPeriod: 2,
};

const currentLocalTime = (): TimeValue => {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
};

export function TimeField({
  value,
  defaultValue,
  onValueChange,
  locale = "fr",
  showSeconds = false,
  disabled = false,
  name,
  className,
  ...rest
}: TimeFieldProps) {
  const [registry] = useState(createItemRegistry);
  const parts = useMemo(
    () => timeFieldParts(locale, { seconds: showSeconds }),
    [locale, showSeconds],
  );
  const segments = useMemo(
    () => parts.filter((p) => p.type !== "literal").map((p) => p.type as TimeSegmentType),
    [parts],
  );
  const periods = useMemo(() => dayPeriodLabels(locale), [locale]);
  const live = useLiveRef({ locale, onValueChange, segments });

  const [config] = useState<TimeFieldConfig>(() => ({
    segments: live.current.segments,
    hourCycle: hourCycleOf(locale),
    dayPeriodLabels: periods,
    getPlaceholderTime: currentLocalTime,
    direction: () => getTextDirection(live.current.locale),
  }));

  const { state, dispatch, store } = useMachine(() => {
    const machine = createTimeFieldMachine(config);
    if (defaultValue || value) {
      // Seed before first render — silent program intent through the reducer.
      const seeded = machine.reduce(machine.initialState, {
        type: segmentFieldIntents.setValues.type,
        payload: { values: timeSegmentValues(value ?? defaultValue ?? null, config) },
        source: "program",
      });
      return { ...machine, initialState: seeded.state };
    }
    return machine;
  });
  const field = state as SegmentFieldState;
  const composed = timeFieldValue(field.values, config);

  // Controlled sync — never fight a draft in progress.
  useEffect(() => {
    if (value === undefined || field.typed !== "") return;
    const same = value === null ? composed === null : isSameTime(composed, value);
    if (!same) {
      dispatch(
        segmentFieldIntents.setValues({ values: timeSegmentValues(value, config) }, "program"),
      );
    }
  }, [value, composed, field.typed, dispatch, config]);

  useForgeEffects(store, {
    registry,
    events: {
      change: (detail) =>
        live.current.onValueChange?.((detail as { value: TimeValue | null }).value),
    },
  });

  const [keymap] = useState(() => timeFieldKeymap(config));
  const onKeyDown = useKeymap(() => keymap, dispatch);

  let editableIndex = -1;
  return (
    <div
      role="group"
      dir={getTextDirection(locale)}
      aria-label={rest["aria-label"]}
      aria-disabled={disabled || undefined}
      onKeyDown={disabled ? undefined : onKeyDown}
      onBlur={(e) => {
        // Leaving the whole group commits any partial segment entry.
        if (!e.currentTarget.contains(e.relatedTarget)) {
          dispatch(segmentFieldIntents.commit(undefined, "pointer"));
        }
      }}
      className={cn(
        "inline-flex h-9 items-center rounded-md border border-border bg-surface px-2 font-mono text-sm tabular-nums transition-colors",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {parts.map((part, partIndex) => {
        if (part.type === "literal") {
          return (
            <span key={partIndex} aria-hidden className="px-px text-muted-foreground">
              {part.value}
            </span>
          );
        }
        editableIndex += 1;
        const index = editableIndex;
        const type = part.type;
        const segmentValue = field.values[type] ?? null;
        const active = field.cursor === index;
        const text =
          segmentValue === null
            ? "––"
            : type === "dayPeriod"
              ? periods[segmentValue === 1 ? 1 : 0]
              : formatNumber(segmentValue, locale, {
                  minimumIntegerDigits: 2,
                  useGrouping: false,
                });
        return (
          <span
            key={partIndex}
            ref={registry.register(String(index))}
            tabIndex={disabled ? -1 : 0}
            {...timeSegmentAria(type, segmentValue, config)}
            aria-label={timeUnitLabel(type, locale)}
            data-active={active || undefined}
            onFocus={() => dispatch(segmentFieldIntents.focusSegment({ index }, "pointer"))}
            className={cn(
              "rounded px-0.5 py-0.5 text-center outline-none",
              "focus:bg-accent focus:text-accent-foreground",
              segmentValue === null && "text-muted-foreground",
            )}
            style={{
              minWidth:
                type === "dayPeriod"
                  ? `${Math.max(periods[0].length, periods[1].length) + 0.5}ch`
                  : `${SEGMENT_WIDTH[type] + 0.5}ch`,
            }}
          >
            {text}
          </span>
        );
      })}
      {name && <input type="hidden" name={name} value={composed ? toISOTime(composed) : ""} />}
    </div>
  );
}
