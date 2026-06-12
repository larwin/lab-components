import { useMemo } from "react";
import {
  formatOffset,
  supportedTimeZones,
  timeZoneCity,
  timeZoneName,
  zoneOffset,
  type Key,
} from "@/framework/core";
import { ComboBox } from "./ComboBox";

/**
 * TimeZoneSelect — the existing ComboBox, untouched: culture-aware search
 * (collator prefix + substring) over "UTC+02:00 · Paris — heure d'Europe
 * centrale" labels. Grouping by offset is pure data: the zone list comes from
 * Intl.supportedValuesOf, each zone's offset is computed at the reference
 * instant (DST-correct), and items are sorted offset-first so equal-offset
 * zones cluster — typing a city, a localized zone name or "+05:30" all match.
 */

export interface TimeZoneSelectProps {
  value?: string | null;
  onValueChange?: (timeZone: string | null) => void;
  /** Offsets shift with DST — they are computed at this instant (default: now). */
  referenceEpochMs?: number;
  locale?: string;
  /** Restrict or re-order the zone list (defaults to Intl.supportedValuesOf). */
  timeZones?: readonly string[];
  placeholder?: string;
  className?: string;
  "aria-label": string;
}

interface ZoneItem {
  id: string;
  offset: number;
  label: string;
}

export function TimeZoneSelect({
  onValueChange,
  referenceEpochMs,
  locale = "fr",
  timeZones,
  placeholder = "Rechercher un fuseau…",
  className,
  ...rest
}: TimeZoneSelectProps) {
  const items = useMemo<ZoneItem[]>(() => {
    const at = referenceEpochMs ?? Date.now();
    const zones = timeZones ?? supportedTimeZones();
    return zones
      .map((id) => {
        const offset = zoneOffset(at, id);
        return {
          id,
          offset,
          label: `${formatOffset(offset)} · ${timeZoneCity(id)} — ${timeZoneName(id, locale, "long", at)}`,
        };
      })
      .sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id));
  }, [referenceEpochMs, timeZones, locale]);

  return (
    <ComboBox<ZoneItem>
      items={items}
      getKey={(item) => item.id}
      getTextValue={(item) => item.label}
      onSelectionChange={(key: Key | null) => onValueChange?.(key)}
      placeholder={placeholder}
      locale={locale}
      className={className}
      aria-label={rest["aria-label"]}
    />
  );
}
