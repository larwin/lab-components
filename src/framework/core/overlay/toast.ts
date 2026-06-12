import { createMachine, withEffects, type Machine } from "../runtime/machine";
import { defineIntent } from "../runtime/intent";
import { announce, defineEffect, emitEvent, type Effect } from "../runtime/effect";

/**
 * Toast queue — a pure machine. Time never ticks inside the core: enqueuing
 * emits a declarative `toast/schedule-dismiss` effect and the adapter owns the
 * actual timer, dispatching `dismiss` when it fires (and interpreting
 * `cancel-dismiss` on manual dismissal). Screen-reader announcements are
 * effects too: errors/warnings are assertive, the rest polite.
 */

export type ToastKind = "info" | "success" | "warning" | "error";

export interface ToastItem {
  readonly id: string;
  readonly kind: ToastKind;
  readonly title: string;
  readonly description?: string;
  /** Auto-dismiss delay (ms); `null` = sticky until manually dismissed. */
  readonly duration: number | null;
  /** Injected by the adapter at dispatch time — the core never reads clocks. */
  readonly createdAt: number;
}

export interface ToastState {
  readonly toasts: readonly ToastItem[];
}

export interface ToastConfig {
  /** Oldest toasts are evicted beyond this count. Default 5. */
  maxToasts?: number;
  /** Default auto-dismiss delay (ms). Default 5000. */
  defaultDuration?: number;
}

export interface EnqueueToastPayload {
  id: string;
  kind?: ToastKind;
  title: string;
  description?: string;
  /** Overrides the config default; `null` = sticky. */
  duration?: number | null;
  /** Timestamp from the adapter (Date.now() at the edge). */
  now: number;
}

export const toastIntents = {
  enqueue: defineIntent<EnqueueToastPayload>("toast/enqueue"),
  dismiss: defineIntent<{ id: string }>("toast/dismiss"),
  clear: defineIntent<void>("toast/clear"),
};

/** Ask the adapter to start a dismiss timer for this toast. */
export const scheduleDismiss = defineEffect<{ id: string; delay: number }>(
  "toast/schedule-dismiss",
);
/** Ask the adapter to cancel a pending dismiss timer. */
export const cancelDismiss = defineEffect<{ id: string }>("toast/cancel-dismiss");

export function createToastMachine(config: ToastConfig = {}): Machine<ToastState> {
  const maxToasts = config.maxToasts ?? 5;
  const defaultDuration = config.defaultDuration ?? 5000;

  return createMachine<ToastState>({
    id: "toast",
    initialState: { toasts: [] },
    handlers: {
      [toastIntents.enqueue.type]: (state, intent) => {
        const payload = intent.payload as EnqueueToastPayload;
        const kind = payload.kind ?? "info";
        const toast: ToastItem = {
          id: payload.id,
          kind,
          title: payload.title,
          description: payload.description,
          duration: payload.duration === undefined ? defaultDuration : payload.duration,
          createdAt: payload.now,
        };

        const effects: Effect[] = [
          announce({
            message: payload.description
              ? `${payload.title}. ${payload.description}`
              : payload.title,
            politeness: kind === "error" || kind === "warning" ? "assertive" : "polite",
          }),
        ];
        if (toast.duration !== null) {
          effects.push(scheduleDismiss({ id: toast.id, delay: toast.duration }));
        }

        // Evict the oldest beyond the cap — and cancel their pending timers.
        let toasts = [...state.toasts, toast];
        while (toasts.length > maxToasts) {
          const evicted = toasts[0];
          toasts = toasts.slice(1);
          if (evicted.duration !== null) effects.push(cancelDismiss({ id: evicted.id }));
        }

        return withEffects({ toasts }, ...effects);
      },

      [toastIntents.dismiss.type]: (state, intent) => {
        const { id } = intent.payload as { id: string };
        const toast = state.toasts.find((t) => t.id === id);
        if (!toast) return state;
        const effects: Effect[] = [emitEvent({ name: "toastDismissed", detail: { id } })];
        if (toast.duration !== null) effects.push(cancelDismiss({ id }));
        return withEffects({ toasts: state.toasts.filter((t) => t.id !== id) }, ...effects);
      },

      [toastIntents.clear.type]: (state) => {
        if (state.toasts.length === 0) return state;
        const effects = state.toasts
          .filter((t) => t.duration !== null)
          .map((t) => cancelDismiss({ id: t.id }));
        return withEffects({ toasts: [] }, ...effects);
      },
    },
  });
}
