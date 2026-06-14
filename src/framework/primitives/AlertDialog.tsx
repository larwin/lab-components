import { useId } from "react";
import { cn } from "@/shared/lib/utils";
import type { DismissReason } from "@/framework/core";
import { Overlay } from "@/framework/react";

/**
 * AlertDialog — a modal that interrupts: role="alertdialog", no dismissal by
 * outside press (and none by Escape unless opted in) — the user must choose.
 * Initial focus lands on the *least destructive* action (the cancel button
 * carries `data-autofocus`, which the Overlay engine honours).
 */

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean, reason?: DismissReason) => void;
  title: string;
  description?: string;
  cancelLabel?: string;
  actionLabel: string;
  /** Runs when the user confirms; the dialog closes afterwards. */
  onAction: () => void;
  /** Style the confirm action as destructive. */
  destructive?: boolean;
  /** Allow Escape/outside dismissal (off by default for an alert). */
  dismissable?: boolean;
  className?: string;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = "Annuler",
  actionLabel,
  onAction,
  destructive = false,
  dismissable = false,
  className,
}: AlertDialogProps) {
  const baseId = useId();

  return (
    <Overlay
      open={open}
      onDismiss={(reason) => {
        if (dismissable) onOpenChange(false, reason);
      }}
      modal
      panelProps={{
        role: "alertdialog",
        "aria-modal": true,
        "aria-labelledby": `${baseId}-title`,
        "aria-describedby": description ? `${baseId}-description` : undefined,
      }}
    >
      <div
        className={cn(
          "w-[26rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl",
          className,
        )}
      >
        <h2 id={`${baseId}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id={`${baseId}-description`} className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            data-autofocus
            onClick={() => onOpenChange(false, "program")}
            className={cn(
              "inline-flex h-9 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium transition-colors outline-none",
              "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onAction();
              onOpenChange(false, "program");
            }}
            className={cn(
              "inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
