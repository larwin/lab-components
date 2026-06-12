import { useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DismissReason } from "@/framework/core";
import { Overlay } from "@/framework/react";

/**
 * Dialog — a controlled modal on the Overlay engine: backdrop, focus trap,
 * focus restore, Escape/outside dismissal, and a *blocking* shortcut scope
 * (page shortcuts are masked while open — try the command palette's Mod+K).
 *
 * Open state is the caller's: dialogs are usually driven by app state, so this
 * primitive stays machine-less by design (see RFC §6).
 */

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean, reason?: DismissReason) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Allow closing via Escape / outside press. */
  dismissable?: boolean;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dismissable = true,
  className,
}: DialogProps) {
  const baseId = useId();

  return (
    <Overlay
      open={open}
      onDismiss={(reason) => {
        if (dismissable) onOpenChange(false, reason);
      }}
      modal
      panelProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": `${baseId}-title`,
        "aria-describedby": description ? `${baseId}-description` : undefined,
      }}
    >
      <div
        className={cn(
          "w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={`${baseId}-title`} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={`${baseId}-description`} className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {dismissable && (
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => onOpenChange(false, "program")}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {children && <div className="mt-4 text-sm">{children}</div>}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </Overlay>
  );
}
