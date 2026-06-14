import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  cancelDismiss,
  createToastMachine,
  scheduleDismiss,
  toastIntents,
  type ToastItem,
  type ToastKind,
  type ToastState,
} from "@/framework/core";
import { useForgeEffects, useMachine } from "@/framework/react";

/**
 * Toast — the pure queue machine rendered as a viewport stack. The machine
 * decides *what* happens (enqueue, evict beyond cap, announce, schedule);
 * this adapter owns the actual setTimeout handles, mapping the declarative
 * `toast/schedule-dismiss` / `toast/cancel-dismiss` effects to real timers.
 * Announcements go through the shared live region — the cards themselves are
 * not live regions, so nothing is spoken twice.
 */

export interface ToastOptions {
  title: string;
  description?: string;
  kind?: ToastKind;
  /** ms; `null` = sticky until manually dismissed. */
  duration?: number | null;
}

interface ToastApi {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside a <ToastProvider>");
  return api;
}

export interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
  defaultDuration?: number;
}

export function ToastProvider({ children, maxToasts, defaultDuration }: ToastProviderProps) {
  const { state, dispatch, store } = useMachine(() =>
    createToastMachine({ maxToasts, defaultDuration }),
  );
  const timers = useRef(new Map<string, number>());
  const counter = useRef(0);

  useForgeEffects(store, {
    events: {},
    overrides: {
      [scheduleDismiss.type]: (effect) => {
        const { id, delay } = effect.payload as { id: string; delay: number };
        const handle = window.setTimeout(
          () => dispatch(toastIntents.dismiss({ id }, "program")),
          delay,
        );
        timers.current.set(id, handle);
      },
      [cancelDismiss.type]: (effect) => {
        const { id } = effect.payload as { id: string };
        const handle = timers.current.get(id);
        if (handle !== undefined) window.clearTimeout(handle);
        timers.current.delete(id);
      },
    },
  });

  const api = useMemo<ToastApi>(
    () => ({
      toast: (options) => {
        const id = `toast-${++counter.current}`;
        dispatch(toastIntents.enqueue({ id, now: Date.now(), ...options }, "program"));
        return id;
      },
      dismiss: (id) => dispatch(toastIntents.dismiss({ id }, "pointer")),
      clear: () => dispatch(toastIntents.clear(undefined, "program")),
    }),
    [dispatch],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport state={state as ToastState} onDismiss={api.dismiss} />
    </ToastContext.Provider>
  );
}

const KIND_STYLES: Record<ToastKind, { icon: ReactNode; bar: string }> = {
  info: { icon: <Info className="size-4 text-primary" />, bar: "bg-primary" },
  success: { icon: <CheckCircle2 className="size-4 text-success" />, bar: "bg-success" },
  warning: { icon: <AlertTriangle className="size-4 text-warning" />, bar: "bg-warning" },
  error: { icon: <XCircle className="size-4 text-destructive" />, bar: "bg-destructive" },
};

function ToastViewport({
  state,
  onDismiss,
}: {
  state: ToastState;
  onDismiss: (id: string) => void;
}) {
  if (typeof document === "undefined" || state.toasts.length === 0) return null;
  return createPortal(
    <div
      role="region"
      aria-label="Notifications"
      className="fixed right-4 bottom-4 z-100 flex w-80 flex-col gap-2"
    >
      {state.toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const { icon, bar } = KIND_STYLES[toast.kind];
  return (
    <div className="relative flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-popover p-3 pl-4 text-popover-foreground shadow-lg">
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 text-sm">
        <p className="font-medium">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        aria-label={`Fermer la notification : ${toast.title}`}
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
