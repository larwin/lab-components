import { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calendarIntents,
  calendarKeymap,
  createCalendarMachine,
  firstDayOfWeek,
  focusElement,
  formatDate,
  formatMonthYear,
  getTextDirection,
  isDateInRange,
  isSameDay,
  monthGrid,
  toISODate,
  weekdayNames,
  type CalendarConfig,
  type CalendarState,
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
 * Calendar — the pure calendar-grid machine rendered as an ARIA grid (APG
 * date-grid pattern: roving tabindex on the day cells). All structure is
 * Intl-derived from `locale`: first day of week, localized weekday/month
 * headers, RTL direction (arrow keys flip in the keymap). Keyboard moves come
 * back as `dom/focus-element` effects keyed by ISO date; the interpreter is
 * overridden to defer one frame so a cell freshly mounted by a month change
 * can receive focus. "Today" is injected — the machine has no clock.
 */

export interface CalendarLabels {
  previousMonth: string;
  nextMonth: string;
  previousYear: string;
  nextYear: string;
}

const DEFAULT_LABELS: CalendarLabels = {
  previousMonth: "Mois précédent",
  nextMonth: "Mois suivant",
  previousYear: "Année précédente",
  nextYear: "Année suivante",
};

export interface CalendarProps {
  value?: DateValue | null;
  defaultValue?: DateValue;
  onValueChange?: (date: DateValue) => void;
  min?: DateValue;
  max?: DateValue;
  isDateDisabled?: (date: DateValue) => boolean;
  /** BCP 47 — drives first day of week, header labels and direction. */
  locale?: string;
  /** Override the locale's first day (0 = Sunday … 6 = Saturday). */
  firstDayOfWeek?: number;
  /** Injected "today" (testing, server time); defaults to the client clock. */
  today?: DateValue;
  labels?: Partial<CalendarLabels>;
  className?: string;
  "aria-label"?: string;
}

const currentLocalDate = (): DateValue => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
};

export function Calendar({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale = "fr",
  firstDayOfWeek: firstDayProp,
  today,
  labels,
  className,
  ...rest
}: CalendarProps) {
  const baseId = useId();
  const [registry] = useState(createItemRegistry);
  const todayValue = today ?? currentLocalDate();
  const fdow = firstDayProp ?? firstDayOfWeek(locale);
  const live = useLiveRef({ min, max, isDateDisabled, locale, fdow, onValueChange });

  const [config] = useState<CalendarConfig>(() => ({
    initialFocus: value ?? defaultValue ?? todayValue,
    defaultValue: value ?? defaultValue ?? null,
    getFirstDayOfWeek: () => live.current.fdow,
    getMin: () => live.current.min ?? null,
    getMax: () => live.current.max ?? null,
    isDateDisabled: (date) => live.current.isDateDisabled?.(date) === true,
    monthLabel: (year, month) => formatMonthYear(year, month, live.current.locale),
    dateLabel: (date) => formatDate(date, live.current.locale, { dateStyle: "full" }),
    direction: () => getTextDirection(live.current.locale),
  }));

  const { state, dispatch, store } = useMachine(() => createCalendarMachine(config));
  const calendar = state as CalendarState;

  // Controlled mode — program-sourced sync, silent by machine contract.
  useEffect(() => {
    if (value === undefined) return;
    if (isSameDay(value, calendar.selectedDate) || (value === null && !calendar.selectedDate))
      return;
    dispatch(calendarIntents.setValue({ date: value }, "program"));
  }, [value, calendar.selectedDate, dispatch]);

  useForgeEffects(store, {
    registry,
    events: {
      change: (detail) => live.current.onValueChange?.((detail as { date: DateValue }).date),
    },
    overrides: {
      // A month change can mount the target cell in this very dispatch — focus
      // one frame later, once React has committed the new grid.
      [focusElement.type]: (effect) => {
        const target = (effect.payload as { target: string }).target;
        requestAnimationFrame(() => registry.get(target)?.focus());
      },
    },
  });

  const [keymap] = useState(() => calendarKeymap(config));
  const onKeyDown = useKeymap(() => keymap, dispatch);

  const { year, month } = calendar.visibleMonth;
  const weeks = monthGrid(year, month, fdow);
  const dayNames = weekdayNames(locale, "short");
  const dayNamesLong = weekdayNames(locale, "long");
  const direction = getTextDirection(locale);
  const monthLabelId = `${baseId}-month`;

  const headerButton = (label: string, icon: React.ReactNode, months: number, years: number) => (
    <button
      type="button"
      aria-label={label}
      onClick={() => dispatch(calendarIntents.movePage({ months, years }, "pointer"))}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
    </button>
  );

  return (
    <div
      dir={direction}
      className={cn("w-fit rounded-lg border border-border bg-surface p-3", className)}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        {headerButton(
          labels?.previousYear ?? DEFAULT_LABELS.previousYear,
          <ChevronsLeft className="size-4 rtl:rotate-180" />,
          0,
          -1,
        )}
        {headerButton(
          labels?.previousMonth ?? DEFAULT_LABELS.previousMonth,
          <ChevronLeft className="size-4 rtl:rotate-180" />,
          -1,
          0,
        )}
        {/* Month changes are announced by the machine (a11y/announce effect). */}
        <h2 id={monthLabelId} className="flex-1 text-center text-sm font-semibold capitalize">
          {formatMonthYear(year, month, locale)}
        </h2>
        {headerButton(
          labels?.nextMonth ?? DEFAULT_LABELS.nextMonth,
          <ChevronRight className="size-4 rtl:rotate-180" />,
          1,
          0,
        )}
        {headerButton(
          labels?.nextYear ?? DEFAULT_LABELS.nextYear,
          <ChevronsRight className="size-4 rtl:rotate-180" />,
          0,
          1,
        )}
      </div>

      <table
        role="grid"
        aria-labelledby={monthLabelId}
        aria-label={rest["aria-label"]}
        onKeyDown={onKeyDown}
        className="border-collapse select-none"
      >
        <thead>
          <tr>
            {Array.from({ length: 7 }, (_, i) => {
              const dow = (fdow + i) % 7;
              return (
                <th
                  key={dow}
                  scope="col"
                  abbr={dayNamesLong[dow]}
                  className="size-9 text-xs font-medium text-muted-foreground"
                >
                  {dayNames[dow]}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={toISODate(week[0].date)}>
              {week.map(({ date, inMonth }) => {
                const iso = toISODate(date);
                const focused = isSameDay(date, calendar.focusedDate);
                const selected = isSameDay(date, calendar.selectedDate);
                const isToday = isSameDay(date, todayValue);
                const disabled =
                  !isDateInRange(date, min ?? null, max ?? null) || isDateDisabled?.(date) === true;
                return (
                  <td
                    key={iso}
                    ref={inMonth ? registry.register(iso) : undefined}
                    role="gridcell"
                    tabIndex={inMonth && focused ? 0 : -1}
                    aria-selected={selected || undefined}
                    aria-disabled={disabled || undefined}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={formatDate(date, locale, { dateStyle: "full" })}
                    data-outside={!inMonth || undefined}
                    onClick={() => {
                      if (!disabled) dispatch(calendarIntents.select({ date }, "pointer"));
                    }}
                    className={cn(
                      "size-9 cursor-default rounded-md text-center text-sm transition-colors outline-none",
                      "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                      !inMonth && "text-muted-foreground/50",
                      isToday && !selected && "font-semibold text-primary",
                      selected && "bg-primary text-primary-foreground hover:bg-primary",
                      disabled && "pointer-events-none opacity-40",
                    )}
                  >
                    {formatDate(date, locale, { day: "numeric" })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
