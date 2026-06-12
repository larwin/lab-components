import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import type { Placement } from "@/framework/core";
import { Overlay } from "@/framework/react";

/**
 * Tooltip — hover/focus description on the Overlay engine.
 *
 * Delay policy: opening waits `openDelay`, but while tooltips are "warm"
 * (one was visible less than `WARM_WINDOW_MS` ago, tracked module-wide)
 * the next one opens instantly — the familiar toolbar feel. Closing is
 * immediate on leave/blur/Escape. The panel is pointer-transparent and
 * linked to the trigger via aria-describedby.
 */

const WARM_WINDOW_MS = 400;
let lastClosedAt = 0;

export interface TooltipProps {
  content: ReactNode;
  /** Single focusable element; receives aria-describedby + hover handlers. */
  children: ReactElement<Record<string, unknown>>;
  placement?: Placement;
  openDelay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  placement = "top",
  openDelay = 600,
  className,
}: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLElement | null>(null);
  const timer = useRef(0);
  const [open, setOpen] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = () => {
    window.clearTimeout(timer.current);
    const warm = performance.now() - lastClosedAt < WARM_WINDOW_MS;
    if (warm || openDelay === 0) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), openDelay);
  };

  const hide = () => {
    window.clearTimeout(timer.current);
    if (open) lastClosedAt = performance.now();
    setOpen(false);
  };

  const child = children;
  const trigger = cloneElement(child, {
    ref: (el: HTMLElement | null) => {
      anchorRef.current = el;
      const original = (child as { ref?: unknown }).ref;
      if (typeof original === "function") original(el);
    },
    "aria-describedby": open ? id : (child.props["aria-describedby"] as string | undefined),
    onPointerEnter: (e: unknown) => {
      (child.props.onPointerEnter as ((e: unknown) => void) | undefined)?.(e);
      show();
    },
    onPointerLeave: (e: unknown) => {
      (child.props.onPointerLeave as ((e: unknown) => void) | undefined)?.(e);
      hide();
    },
    onFocus: (e: unknown) => {
      (child.props.onFocus as ((e: unknown) => void) | undefined)?.(e);
      show();
    },
    onBlur: (e: unknown) => {
      (child.props.onBlur as ((e: unknown) => void) | undefined)?.(e);
      hide();
    },
  });

  return (
    <>
      {trigger}
      <Overlay
        open={open}
        onDismiss={hide}
        anchorRef={anchorRef}
        placement={placement}
        offset={8}
        restoreFocus={false}
        panelProps={{ role: "tooltip", id }}
        style={{ pointerEvents: "none" }}
        className={cn(
          "max-w-64 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md",
          className,
        )}
      >
        {content}
      </Overlay>
    </>
  );
}
