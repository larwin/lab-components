import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  composeMachine,
  dismissable,
  dismissIntents,
  type DismissableSlice,
  type DismissReason,
  type Placement,
} from "@/framework/core";
import { Overlay, useComposedMachine } from "@/framework/react";

/**
 * Popover — anchored, non-modal disclosure on the Overlay engine, driven by a
 * Dismissable machine (so open/close transitions appear in the inspector like
 * everything else). Focus moves into the panel and is restored on close;
 * outside-press and Escape dismiss via the shared layer stack.
 */

export interface PopoverProps {
  /** Trigger button content. */
  trigger: ReactNode;
  children: ReactNode;
  placement?: Placement;
  "aria-label": string;
  className?: string;
  triggerClassName?: string;
}

const popoverBehaviors = [dismissable] as const;

export function Popover({
  trigger,
  children,
  placement = "bottom-start",
  className,
  triggerClassName,
  ...props
}: PopoverProps) {
  const baseId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { state, dispatch } = useComposedMachine(() =>
    composeMachine("popover", popoverBehaviors, {}),
  );
  const open = (state.dismissable as DismissableSlice).open;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? baseId : undefined}
        onClick={() => dispatch(dismissIntents.toggle(undefined, "pointer"))}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium transition-colors outline-none",
          "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      <Overlay
        open={open}
        onDismiss={(reason: DismissReason) => dispatch(dismissIntents.close({ reason }, "program"))}
        anchorRef={triggerRef}
        placement={placement}
        offset={6}
        panelProps={{ id: baseId, role: "dialog", "aria-label": props["aria-label"] }}
      >
        <div
          data-autofocus
          tabIndex={-1}
          className={cn(
            "w-72 rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-lg outline-none",
            className,
          )}
        >
          {children}
        </div>
      </Overlay>
    </>
  );
}
