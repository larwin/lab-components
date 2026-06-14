import { useId, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { DismissReason } from "@/framework/core";
import { Overlay } from "@/framework/react";

/**
 * Drawer / Sheet — the Overlay engine in modal mode with edge anchoring:
 * backdrop, focus trap/restore and the blocking shortcut scope come for free;
 * this shell only pins the panel to a side instead of centering it. Like
 * Dialog, open state belongs to the caller (machine-less by design).
 */

export type DrawerSide = "left" | "right" | "bottom";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean, reason?: DismissReason) => void;
  side?: DrawerSide;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Allow closing via Escape / outside press. */
  dismissable?: boolean;
  className?: string;
}

const SIDE_STYLES: Record<DrawerSide, CSSProperties> = {
  left: { position: "fixed", top: 0, bottom: 0, left: 0 },
  right: { position: "fixed", top: 0, bottom: 0, right: 0 },
  bottom: { position: "fixed", left: 0, right: 0, bottom: 0 },
};

const SIDE_CLASSES: Record<DrawerSide, string> = {
  left: "h-full w-80 max-w-[85vw] border-r",
  right: "h-full w-80 max-w-[85vw] border-l",
  bottom: "max-h-[70vh] w-full border-t",
};

export function Drawer({
  open,
  onOpenChange,
  side = "right",
  title,
  description,
  children,
  footer,
  dismissable = true,
  className,
}: DrawerProps) {
  const baseId = useId();

  return (
    <Overlay
      open={open}
      onDismiss={(reason) => {
        if (dismissable) onOpenChange(false, reason);
      }}
      modal
      style={SIDE_STYLES[side]}
      panelProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": `${baseId}-title`,
        "aria-describedby": description ? `${baseId}-description` : undefined,
      }}
    >
      <div
        className={cn(
          "flex h-full flex-col border-border bg-popover p-6 text-popover-foreground shadow-2xl",
          SIDE_CLASSES[side],
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
              aria-label="Fermer le panneau"
              onClick={() => onOpenChange(false, "program")}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {children && <div className="mt-4 flex-1 overflow-y-auto text-sm">{children}</div>}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </Overlay>
  );
}
