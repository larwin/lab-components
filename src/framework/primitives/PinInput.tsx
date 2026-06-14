import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import {
  createPinMachine,
  pinIntents,
  pinKeymap,
  type PinKind,
  type PinState,
} from "@/framework/core";
import { createItemRegistry, useForgeEffects, useKeymap, useMachine } from "@/framework/react";
import { useLiveRef } from "@/framework/react";

/**
 * PinInput / OTP — the dedicated pure pin machine rendered as N one-character
 * inputs. The machine owns the segment cursor: arrows/Backspace/Home/End and
 * paste distribution are intents, and cursor moves come back as declarative
 * `dom/focus-element` effects resolved through the registry (segments are
 * registered by index). `onComplete` fires once when the last slot fills;
 * `autoSubmit` then submits the surrounding form.
 */

export interface PinInputProps {
  /** Number of segments. */
  length?: number;
  kind?: PinKind;
  value?: string;
  onValueChange?: (value: string) => void;
  /** Fired once when every segment is filled. */
  onComplete?: (value: string) => void;
  /** Submit the surrounding <form> on completion. */
  autoSubmit?: boolean;
  /** Render dots instead of characters (PIN codes). */
  masked?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
  "aria-label": string;
}

export function PinInput({
  length = 6,
  kind = "numeric",
  value,
  onValueChange,
  onComplete,
  autoSubmit = false,
  masked = false,
  disabled = false,
  name,
  className,
  ...rest
}: PinInputProps) {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [registry] = useState(createItemRegistry);
  const live = useLiveRef({ onValueChange, onComplete, autoSubmit });

  const { state, dispatch, store } = useMachine(() => createPinMachine({ length, kind }));
  const pin = state as PinState;
  const joined = pin.values.join("");

  // Controlled value: program-sourced sync (never steals DOM focus).
  useEffect(() => {
    if (value === undefined || value === joined) return;
    dispatch(pinIntents.clear(undefined, "program"));
    if (value !== "") dispatch(pinIntents.paste({ text: value }, "program"));
  }, [value, joined, dispatch]);

  useForgeEffects(store, {
    registry,
    events: {
      change: (detail) => live.current.onValueChange?.((detail as { value: string }).value),
      complete: (detail) => {
        const v = (detail as { value: string }).value;
        live.current.onComplete?.(v);
        if (live.current.autoSubmit) {
          groupRef.current?.closest("form")?.requestSubmit();
        }
      },
    },
  });

  const [keymap] = useState(() => pinKeymap({ length, kind }));
  const onKeyDown = useKeymap(() => keymap, dispatch);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={rest["aria-label"]}
      className={cn("flex items-center gap-2", className)}
    >
      {pin.values.map((segment, index) => (
        <input
          key={index}
          ref={registry.register(String(index))}
          type={masked ? "password" : "text"}
          inputMode={kind === "numeric" ? "numeric" : "text"}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Caractère ${index + 1} sur ${length}`}
          value={segment}
          disabled={disabled}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            // Keydown handles physical keyboards (and preventDefaults); this
            // path serves IME/mobile keyboards, distributing like a paste.
            const text = e.target.value;
            if (text !== "") dispatch(pinIntents.paste({ text }, "keyboard"));
          }}
          onPaste={(e) => {
            e.preventDefault();
            dispatch(pinIntents.paste({ text: e.clipboardData.getData("text") }, "keyboard"));
          }}
          onFocus={(e) => {
            dispatch(pinIntents.focusSegment({ index }, "pointer"));
            e.target.select();
          }}
          className={cn(
            "size-10 rounded-md border border-border bg-surface text-center font-mono text-lg transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        />
      ))}
      {name && <input type="hidden" name={name} value={joined} />}
    </div>
  );
}
