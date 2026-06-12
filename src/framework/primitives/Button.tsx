import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  composeMachine,
  focusable,
  focusIntents,
  pressable,
  pressIntents,
  formatKeyCombo,
} from "@/framework/core";
import {
  detectPlatform,
  useComposedMachine,
  useForgeEffects,
  useKeymap,
  useLiveRef,
  useShortcut,
} from "@/framework/react";

/**
 * Button — the canonical behavior composition: Focusable + Pressable.
 *
 * Pointer, keyboard and *global shortcut* all converge on the same
 * `press/activate` intent, so a button can be triggered by "Mod+S" without
 * holding focus — and the journal shows exactly which source fired it.
 */

export interface ButtonProps {
  children: ReactNode;
  onPress?: (detail: { source: string }) => void;
  /**
   * "submit" requests the enclosing form's submission *through* the press
   * event (keyboard, pointer and shortcut all converge on it) — the DOM
   * element stays type="button" so nothing fires twice.
   */
  type?: "button" | "submit";
  disabled?: boolean;
  /** Global shortcut (e.g. "Mod+S") that activates this button focus-free. */
  shortcut?: string;
  showShortcut?: boolean;
  variant?: "default" | "primary" | "destructive";
  className?: string;
}

const buttonBehaviors = [focusable, pressable] as const;

export function Button({
  children,
  onPress,
  type = "button",
  disabled = false,
  shortcut,
  showShortcut = true,
  variant = "default",
  className,
}: ButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const live = useLiveRef({ onPress, disabled, type });

  const { state, dispatch, store, composed } = useComposedMachine(() =>
    composeMachine("button", buttonBehaviors, {
      get disabled() {
        return live.current.disabled;
      },
    }),
  );

  useForgeEffects(store, {
    events: {
      press: (detail) => {
        live.current.onPress?.(detail as { source: string });
        if (live.current.type === "submit") buttonRef.current?.form?.requestSubmit();
      },
    },
  });

  const onKeyDown = useKeymap(() => composed.keymap(state), dispatch);

  useShortcut(shortcut ?? "", () => dispatch(pressIntents.activate(undefined, "shortcut")), {
    global: true,
    enabled: !!shortcut && !disabled,
    description: "Activate button",
  });

  const [platform] = useState(detectPlatform);

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      {...composed.aria(state)}
      onKeyDown={onKeyDown}
      onPointerDown={() => dispatch(pressIntents.start(undefined, "pointer"))}
      onPointerUp={() => dispatch(pressIntents.end(undefined, "pointer"))}
      onPointerLeave={() => dispatch(pressIntents.cancel(undefined, "pointer"))}
      onFocus={() => dispatch(focusIntents.focus({}, "keyboard"))}
      onBlur={() => dispatch(focusIntents.blur(undefined))}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        "data-[pressed]:scale-[0.98]",
        variant === "default" && "border border-border bg-surface hover:bg-muted",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "destructive" &&
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        className,
      )}
    >
      {children}
      {shortcut && showShortcut && (
        <kbd className="rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          {formatKeyCombo(shortcut, platform)}
        </kbd>
      )}
    </button>
  );
}
