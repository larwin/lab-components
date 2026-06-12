import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  createDateFieldMachine,
  dateFieldIntents,
  dateFieldKeymap,
  dateFieldParts,
  dateFieldValue,
  dateSegmentAria,
  dateUnitLabel,
  formatNumber,
  getTextDirection,
  isSameDay,
  toISODate,
  type DateFieldConfig,
  type DateFieldState,
  type DateSegmentType,
  type DateValue,
} from "@/framework/core";
import {
  createItemRegistry,
  useForgeEffects,
  useKeymap,
  useLiveRef,
  useMachine,
} from "@/framework/react";

/**
 * DateField — segmented day/month/year input in locale order (Intl
 * formatToParts decides dd/mm/yyyy vs mm/dd/yyyy and the separators). Each
 * segment is a spinbutton driven by the pure date-field machine: digits type
 * with auto-advance, arrows step with wrap, Backspace clears then walks back
 * (the PIN pattern), and `change` fires only at commit points — leaving the
 * group commits any draft via the `commit` intent. Digits render through
 * formatNumber, so ar locales show Arabic-Indic numerals.
 */

export interface DateFieldProps {
  value?: DateValue | null;
  defaultValue?: DateValue;
  onValueChange?: (date: DateValue | null) => void;
  locale?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
  "aria-label"?: string;
}

const SEGMENT_PLACEHOLDER: Record<DateSegmentType, string> = {
  day: "––",
  month: "––",
  year: "––––",
};
const SEGMENT_WIDTH: Record<DateSegmentType, number> = { day: 2, month: 2, year: 4 };

const currentLocalDate = (): DateValue => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
};

export function DateField({
  value,
  defaultValue,
  onValueChange,
  locale = "fr",
  disabled = false,
  name,
  className,
  ...rest
}: DateFieldProps) {
  const [registry] = useState(createItemRegistry);
  const parts = useMemo(() => dateFieldParts(locale), [locale]);
  const segments = useMemo(
    () => parts.filter((p) => p.type !== "literal").map((p) => p.type as DateSegmentType),
    [parts],
  );
  const live = useLiveRef({ locale, onValueChange, segments });

  const [config] = useState<DateFieldConfig>(() => ({
    segments: live.current.segments,
    getPlaceholderDate: currentLocalDate,
    direction: () => getTextDirection(live.current.locale),
  }));

  const { state, dispatch, store } = useMachine(() => {
    const machine = createDateFieldMachine(config);
    if (defaultValue || value) {
      // Seed before first render — silent program intent through the reducer.
      const seeded = machine.reduce(machine.initialState, {
        type: dateFieldIntents.setValue.type,
        payload: { date: value ?? defaultValue ?? null },
        source: "program",
      });
      return { ...machine, initialState: seeded.state };
    }
    return machine;
  });
  const field = state as DateFieldState;
  const composed = dateFieldValue(field);

  // Controlled sync — never fight a draft in progress.
  useEffect(() => {
    if (value === undefined || field.typed !== "") return;
    const same = value === null ? composed === null : isSameDay(composed, value);
    if (!same) dispatch(dateFieldIntents.setValue({ date: value }, "program"));
  }, [value, composed, field.typed, dispatch]);

  useForgeEffects(store, {
    registry,
    events: {
      change: (detail) => live.current.onValueChange?.((detail as { date: DateValue | null }).date),
    },
  });

  const [keymap] = useState(() => dateFieldKeymap(config));
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
          dispatch(dateFieldIntents.commit(undefined, "pointer"));
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
        const segmentValue = field[type];
        const active = field.cursor === index;
        return (
          <span
            key={partIndex}
            ref={registry.register(String(index))}
            tabIndex={disabled ? -1 : 0}
            {...dateSegmentAria(type, segmentValue)}
            aria-label={dateUnitLabel(type, locale)}
            data-active={active || undefined}
            onFocus={() => dispatch(dateFieldIntents.focusSegment({ index }, "pointer"))}
            className={cn(
              "rounded px-0.5 py-0.5 text-center outline-none",
              "focus:bg-accent focus:text-accent-foreground",
              segmentValue === null && "text-muted-foreground",
            )}
            style={{ minWidth: `${SEGMENT_WIDTH[type] + 0.5}ch` }}
          >
            {segmentValue === null
              ? SEGMENT_PLACEHOLDER[type]
              : formatNumber(segmentValue, locale, {
                  minimumIntegerDigits: SEGMENT_WIDTH[type],
                  useGrouping: false,
                })}
          </span>
        );
      })}
      {name && <input type="hidden" name={name} value={composed ? toISODate(composed) : ""} />}
    </div>
  );
}
