import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { computePosition, type Placement } from "../core/overlay/positioning";
import type { DismissReason } from "../core/behaviors/dismissable";
import { ShortcutScope } from "./shortcuts";
import { useLiveRef } from "./useMachine";

/**
 * Overlay — the single rendering engine behind menus, popovers, combo box
 * lists, dialogs and (later) tooltips.
 *
 * Responsibilities at this layer (and only this layer):
 *  - portal to document.body, z-index derived from a global layer stack
 *  - outside-press: clicking inside layer N dismisses every layer above N;
 *    clicking outside all layers dismisses the topmost chain
 *  - Escape dismisses the topmost layer only
 *  - focus: saved on open, trapped while modal, restored on close
 *  - anchored positioning via the pure core (flip/shift), tracked on
 *    scroll/resize
 *  - modal overlays activate a *blocking* shortcut scope, masking page
 *    shortcuts (see core/interaction/shortcuts)
 *
 * Open/close *state* does not live here — it belongs to the owning machine
 * (Dismissable behavior) or the caller. The Overlay only reports dismiss
 * requests through `onDismiss`.
 */

interface OverlayLayer {
  id: number;
  element: HTMLElement | null;
  anchor: HTMLElement | null;
  modal: boolean;
  dismiss: (reason: DismissReason) => void;
}

const layerStack: OverlayLayer[] = [];
let layerSeq = 0;
let documentListenersInstalled = false;

const installDocumentListeners = () => {
  if (documentListenersInstalled || typeof document === "undefined") return;
  documentListenersInstalled = true;

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (layerStack.length === 0) return;
      const target = event.target as Node;
      let containingIndex = -1;
      for (let i = layerStack.length - 1; i >= 0; i--) {
        const layer = layerStack[i];
        if (layer.element?.contains(target) || layer.anchor?.contains(target)) {
          containingIndex = i;
          break;
        }
      }
      // Dismiss everything above the layer that owns the press.
      for (let i = layerStack.length - 1; i > containingIndex; i--) {
        layerStack[i].dismiss("outside");
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || layerStack.length === 0) return;
      event.stopPropagation();
      layerStack[layerStack.length - 1].dismiss("escape");
    },
    true,
  );
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface OverlayProps {
  open: boolean;
  /** The overlay wants to close (outside press, Escape). Update your state. */
  onDismiss: (reason: DismissReason) => void;
  children: ReactNode;
  /** Anchored mode: positions next to this element and tracks it. */
  anchorRef?: RefObject<HTMLElement | null>;
  placement?: Placement;
  offset?: number;
  /** Match the overlay width to the anchor width (combo boxes). */
  matchAnchorWidth?: boolean;
  /** Modal: focus trap + blocking shortcut scope + initial focus. */
  modal?: boolean;
  restoreFocus?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Extra props spread on the floating element (role, aria-*, ids). */
  panelProps?: Record<string, unknown>;
}

export function Overlay({
  open,
  onDismiss,
  children,
  anchorRef,
  placement = "bottom-start",
  offset = 4,
  matchAnchorWidth = false,
  modal = false,
  restoreFocus = true,
  className,
  style,
  panelProps,
}: OverlayProps) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [zIndex, setZIndex] = useState(50);
  const live = useLiveRef({ onDismiss, anchorRef });
  const layerRef = useRef<OverlayLayer | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  /* ---- layer stack registration ---- */
  useEffect(() => {
    if (!open) return;
    installDocumentListeners();
    const layer: OverlayLayer = {
      id: ++layerSeq,
      element: null,
      anchor: live.current.anchorRef?.current ?? null,
      modal,
      dismiss: (reason) => live.current.onDismiss(reason),
    };
    layerRef.current = layer;
    layerStack.push(layer);
    setZIndex(50 + layerStack.length);
    return () => {
      const index = layerStack.indexOf(layer);
      if (index >= 0) layerStack.splice(index, 1);
      layerRef.current = null;
    };
  }, [open, modal, live]);

  useEffect(() => {
    if (layerRef.current) layerRef.current.element = element;
  }, [element]);

  /* ---- focus save / initial focus / restore ---- */
  useEffect(() => {
    if (!open || !element) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial =
      element.querySelector<HTMLElement>("[data-autofocus]") ??
      (modal ? (element.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? element) : null);
    initial?.focus();
    return () => {
      if (restoreFocus && previousFocus.current?.isConnected) {
        previousFocus.current.focus();
      }
    };
  }, [open, element, modal, restoreFocus]);

  /* ---- focus trap (modal only) ---- */
  const onKeyDownTrap = useCallback(
    (event: React.KeyboardEvent) => {
      if (!modal || event.key !== "Tab" || !element) return;
      const focusables = [...element.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === element)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [modal, element],
  );

  /* ---- anchored positioning, tracked on scroll/resize ---- */
  useLayoutEffect(() => {
    if (!open || !element) return;
    const anchor = anchorRef?.current;
    if (!anchor) {
      setPosition(null); // non-anchored overlays center via CSS
      return;
    }
    const update = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const overlayRect = element.getBoundingClientRect();
      const result = computePosition({
        anchor: {
          x: anchorRect.x,
          y: anchorRect.y,
          width: anchorRect.width,
          height: anchorRect.height,
        },
        overlay: { width: overlayRect.width, height: overlayRect.height },
        boundary: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
        placement,
        offset,
      });
      setPosition((prev) =>
        prev && prev.x === result.x && prev.y === result.y ? prev : { x: result.x, y: result.y },
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, element, anchorRef, placement, offset]);

  if (!open || typeof document === "undefined") return null;

  const anchored = !!anchorRef;
  const anchorWidth = matchAnchorWidth
    ? anchorRef?.current?.getBoundingClientRect().width
    : undefined;

  const floating = (
    <div
      ref={setElement}
      onKeyDown={onKeyDownTrap}
      {...panelProps}
      className={className}
      style={{
        // Anchored overlays are viewport-fixed; modal panels flow inside the
        // centering backdrop grid instead.
        position: anchored ? "fixed" : modal ? "relative" : "fixed",
        zIndex,
        ...(anchored
          ? {
              left: position?.x ?? -9999,
              top: position?.y ?? -9999,
              ...(anchorWidth ? { width: anchorWidth } : {}),
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );

  return createPortal(
    <ShortcutScope blocking={modal}>
      {modal ? (
        <div style={{ position: "fixed", inset: 0, zIndex: zIndex - 1 }}>
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0 }}
            className="bg-black/40 backdrop-blur-[2px]"
          />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            {floating}
          </div>
        </div>
      ) : (
        floating
      )}
    </ShortcutScope>,
    document.body,
  );
}
