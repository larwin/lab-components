import { useCallback, useState } from "react";

export interface LogEntry {
  id: number;
  level: "info" | "event" | "warn" | "error";
  message: string;
  data?: unknown;
  timestamp: number;
}

let counter = 0;

/**
 * A lightweight in-memory event log used by the Debug page and demos.
 *
 * Extension point: a future "effects engine" can pipe its dispatched effects
 * through a shared logger of this shape for time-travel debugging.
 */
export function useEventLog(limit = 100) {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const log = useCallback(
    (level: LogEntry["level"], message: string, data?: unknown) => {
      setEntries((prev) =>
        [{ id: ++counter, level, message, data, timestamp: Date.now() }, ...prev].slice(0, limit),
      );
    },
    [limit],
  );

  const clear = useCallback(() => setEntries([]), []);

  return { entries, log, clear };
}
