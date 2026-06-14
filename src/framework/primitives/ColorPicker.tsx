import { useEffect, useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  clampRgb,
  composeMachine,
  focusable,
  formatHex,
  hsvToRgb,
  numberIntents,
  numericValue,
  parseColor,
  rgbToHsv,
  type HsvaColor,
  type NumericValueSlice,
  type RgbColor,
} from "@/framework/core";
import {
  announceNow,
  detectPlatform,
  resolveBinding,
  strokeFromEvent,
  useComposedMachine,
  useForgeEffects,
  useLiveRef,
} from "@/framework/react";
import { NumberField } from "./NumberField";
import { Slider } from "./Slider";
import { TextField } from "./TextField";
import { ToggleGroup } from "./ToggleGroup";

/**
 * ColorPicker — NO color machine. The 2D saturation/brightness surface is
 * **NumericValue ×2** (one machine per axis — the 6th and 7th reuses of the
 * behavior): ↑/↓ resolve against the Y machine (spinbutton profile), ←/→ and
 * Home/End against the X machine (slider profile), and the pointer converts
 * its position into the same two `number/set` intents (the Slider pattern).
 * Hue and alpha are the existing Slider untouched; hex is the TextField with
 * core parsing committed at blur/Enter (the draft/commit lesson); R/G/B are
 * NumberFields; swatches are a ToggleGroup.
 *
 * Everything converges on ONE HSV+alpha state — the internal source of
 * truth, so hue survives zero saturation and saturation survives black
 * (an RGB round-trip would lose both).
 *
 * The "close to <named color>" SR announcement is injected via `colorName`:
 * the CSS named-colors table is a tree-shakable LEAF module
 * (core/color/named) that this primitive deliberately does not import.
 */

export interface ColorSwatchDef {
  key: string;
  /** Any parseable CSS color (hex, rgb(), hsl(), oklch()). */
  color: string;
  label?: string;
}

export interface ColorPickerLabels {
  area: string;
  saturation: string;
  brightness: string;
  hue: string;
  alpha: string;
  hex: string;
  red: string;
  green: string;
  blue: string;
  eyeDropper: string;
  swatches: string;
}

const DEFAULT_LABELS: ColorPickerLabels = {
  area: "Saturation et luminosité",
  saturation: "saturation",
  brightness: "luminosité",
  hue: "Teinte",
  alpha: "Opacité",
  hex: "Hex",
  red: "R",
  green: "V",
  blue: "B",
  eyeDropper: "Pipette (prélever une couleur à l'écran)",
  swatches: "Couleurs prédéfinies",
};

export interface ColorPickerProps {
  value?: HsvaColor;
  defaultValue?: HsvaColor;
  onValueChange?: (color: HsvaColor) => void;
  /** Hide to drop the alpha slider (hex input then ignores alpha digits). */
  showAlpha?: boolean;
  swatches?: readonly ColorSwatchDef[];
  /** EyeDropper API — adapter-only, feature-detected, never in the core. */
  eyeDropper?: boolean;
  /**
   * SR announcement for the committed color ("proche de cornflowerblue").
   * Wire `nearestNamedColor` from core/color/named here — the leaf module
   * stays out of the bundle unless you do.
   */
  colorName?: (rgb: RgbColor) => string | null;
  labels?: Partial<ColorPickerLabels>;
  className?: string;
}

/** rgb → hsva preserving hue at zero saturation and saturation at black. */
const hsvaFromRgb = (rgb: RgbColor, previous: HsvaColor, alpha = previous.a): HsvaColor => {
  const hsv = rgbToHsv(clampRgb(rgb));
  return {
    h: hsv.s === 0 ? previous.h : hsv.h,
    s: hsv.v === 0 ? previous.s : hsv.s,
    v: hsv.v,
    a: alpha,
  };
};

const rgbCss = ({ r, g, b }: RgbColor, alpha = 1): string =>
  `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)}${alpha < 1 ? ` / ${alpha}` : ""})`;

const HUE_RAIL = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";

type EyeDropperHost = { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } };

export function ColorPicker({
  value,
  defaultValue,
  onValueChange,
  showAlpha = true,
  swatches,
  eyeDropper = true,
  colorName,
  labels: labelOverrides,
  className,
}: ColorPickerProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const [internal, setInternal] = useState<HsvaColor>(
    () => value ?? defaultValue ?? { h: 210, s: 80, v: 90, a: 1 },
  );
  const current = value ?? internal;

  // Synchronous mirror: two commits in the same tick (the 2D surface fires
  // one per axis) must each see the previous one's result.
  const colorRef = useRef(current);
  colorRef.current = current;
  const lastNameRef = useRef<string | null>(null);

  const live = useLiveRef({ value, onValueChange, colorName, showAlpha });

  const commit = (patch: Partial<HsvaColor>) => {
    const next = { ...colorRef.current, ...patch };
    colorRef.current = next;
    if (live.current.value === undefined) setInternal(next);
    live.current.onValueChange?.(next);
    const name = live.current.colorName?.(hsvToRgb(next));
    if (name && name !== lastNameRef.current) {
      lastNameRef.current = name;
      announceNow(name, "polite");
    }
  };

  const rgb = hsvToRgb(current);
  const hexValue = formatHex(rgb, showAlpha ? current.a : 1);

  /* ---- hex draft: commit at blur/Enter only (the segment-field lesson) ---- */
  const [hexDraft, setHexDraft] = useState(hexValue);
  const hexFocused = useRef(false);
  useEffect(() => {
    if (!hexFocused.current) setHexDraft(hexValue);
  }, [hexValue]);

  const commitHex = () => {
    const parsed = parseColor(hexDraft.trim());
    if (parsed) {
      commit(hsvaFromRgb(parsed.rgb, colorRef.current, showAlpha ? parsed.alpha : 1));
    } else {
      setHexDraft(hexValue); // revert, like native steppers
    }
  };

  /* ---- swatch selection = derived state ---- */
  const currentHex = formatHex(rgb);
  const selectedSwatch = swatches?.find((s) => {
    const parsed = parseColor(s.color);
    return parsed !== null && formatHex(parsed.rgb) === currentHex;
  });

  const [eyeDropperSupported] = useState(
    () => typeof window !== "undefined" && "EyeDropper" in window,
  );
  const openEyeDropper = () => {
    const host = window as unknown as EyeDropperHost;
    if (!host.EyeDropper) return;
    new host.EyeDropper()
      .open()
      .then(({ sRGBHex }) => {
        const parsed = parseColor(sRGBHex);
        if (parsed) commit(hsvaFromRgb(parsed.rgb, colorRef.current));
      })
      .catch(() => {
        // Dismissed — nothing to do.
      });
  };

  const channel = (key: "r" | "g" | "b", label: string) => (
    <NumberField
      label={label}
      min={0}
      max={255}
      step={1}
      value={Math.round(rgb[key])}
      onValueChange={(next) => {
        if (next === null) return;
        commit(hsvaFromRgb({ ...hsvToRgb(colorRef.current), [key]: next }, colorRef.current));
      }}
      className="w-20"
    />
  );

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-4", className)}>
      <ColorArea hsva={current} labels={labels} onCommit={commit} />

      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="size-9 shrink-0 rounded-md border border-border"
          style={{
            background: `linear-gradient(${rgbCss(rgb, current.a)}, ${rgbCss(rgb, current.a)}), repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%)`,
            backgroundSize: "auto, 12px 12px",
          }}
        />
        <div className="flex flex-1 flex-col gap-2">
          <Slider
            min={0}
            max={360}
            step={1}
            value={current.h}
            onValueChange={(h) => commit({ h })}
            aria-label={labels.hue}
            formatValue={(h) => `${Math.round(h)}°`}
            showValue={false}
            trackStyle={{ background: HUE_RAIL }}
            className="max-w-none"
          />
          {showAlpha && (
            <Slider
              min={0}
              max={100}
              step={1}
              value={Math.round(current.a * 100)}
              onValueChange={(a) => commit({ a: a / 100 })}
              aria-label={labels.alpha}
              formatValue={(a) => `${a} %`}
              showValue={false}
              trackStyle={{
                background: `linear-gradient(to right, ${rgbCss(rgb, 0)}, ${rgbCss(rgb)}), repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%)`,
                backgroundSize: "auto, 12px 12px",
              }}
              className="max-w-none"
            />
          )}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div
          className="min-w-28 flex-1"
          onBlur={() => {
            hexFocused.current = false;
            commitHex();
          }}
          onFocus={() => {
            hexFocused.current = true;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHex();
          }}
        >
          <TextField
            label={labels.hex}
            value={hexDraft}
            onValueChange={setHexDraft}
            validate={(text) => (parseColor(text.trim()) ? null : "Couleur invalide")}
          />
        </div>
        {channel("r", labels.red)}
        {channel("g", labels.green)}
        {channel("b", labels.blue)}
      </div>

      {(swatches?.length || (eyeDropper && eyeDropperSupported)) && (
        <div className="flex items-center gap-2">
          {swatches && swatches.length > 0 && (
            <ToggleGroup
              mode="single"
              aria-label={labels.swatches}
              items={swatches.map((swatch) => ({
                key: swatch.key,
                "aria-label": swatch.label ?? swatch.key,
                icon: (
                  <span
                    className="block size-4 rounded-sm border border-black/10"
                    style={{ background: swatch.color }}
                  />
                ),
              }))}
              value={selectedSwatch ? [selectedSwatch.key] : []}
              onValueChange={(keys) => {
                const swatch = swatches.find((s) => s.key === keys[0]);
                const parsed = swatch ? parseColor(swatch.color) : null;
                if (parsed) {
                  commit(hsvaFromRgb(parsed.rgb, colorRef.current, parsed.alpha));
                }
              }}
            />
          )}
          {eyeDropper && eyeDropperSupported && (
            <button
              type="button"
              aria-label={labels.eyeDropper}
              title={labels.eyeDropper}
              onClick={openEyeDropper}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface transition-colors outline-none",
                "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Pipette className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The 2D surface — NumericValue ×2                                    */
/* ------------------------------------------------------------------ */

const areaBehaviorsX = [focusable, numericValue] as const;
const areaBehaviorsY = [numericValue] as const;

function ColorArea({
  hsva,
  labels,
  onCommit,
}: {
  hsva: HsvaColor;
  labels: ColorPickerLabels;
  onCommit: (patch: Partial<HsvaColor>) => void;
}) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [platform] = useState(detectPlatform);
  const live = useLiveRef({ onCommit });

  // X = saturation: the slider keymap profile (←/→, Shift, Home/End).
  const {
    state: xState,
    dispatch: xDispatch,
    store: xStore,
    composed: xComposed,
  } = useComposedMachine(() =>
    composeMachine("color-area-x", areaBehaviorsX, {
      min: 0,
      max: 100,
      step: 1,
      bigStep: 10,
      keys: "slider" as const,
    }),
  );
  // Y = brightness: the spinbutton profile (↑/↓, Shift, PageUp/PageDown).
  const {
    state: yState,
    dispatch: yDispatch,
    store: yStore,
    composed: yComposed,
  } = useComposedMachine(() =>
    composeMachine("color-area-y", areaBehaviorsY, {
      min: 0,
      max: 100,
      step: 1,
      bigStep: 10,
    }),
  );

  const sat = (xState.numeric as NumericValueSlice).value ?? 0;
  const val = (yState.numeric as NumericValueSlice).value ?? 0;

  // Controlled sync — the surface always mirrors the composed HSV state.
  useEffect(() => {
    if (Math.abs(hsva.s - sat) > 1e-9) {
      xDispatch(numberIntents.set({ value: hsva.s }, "program"));
    }
  }, [hsva.s, sat, xDispatch]);
  useEffect(() => {
    if (Math.abs(hsva.v - val) > 1e-9) {
      yDispatch(numberIntents.set({ value: hsva.v }, "program"));
    }
  }, [hsva.v, val, yDispatch]);

  useForgeEffects(xStore, {
    events: {
      change: (detail) => {
        const v = (detail as { value: number | null }).value;
        if (v !== null) live.current.onCommit({ s: v });
      },
    },
  });
  useForgeEffects(yStore, {
    events: {
      change: (detail) => {
        const v = (detail as { value: number | null }).value;
        if (v !== null) live.current.onCommit({ v });
      },
    },
  });

  // Y resolves first: ↑/↓/Page belong to brightness, the X slider profile
  // would otherwise capture them too.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const stroke = strokeFromEvent(e);
    const ry = resolveBinding(yComposed.keymap(yStore.getState()), stroke, platform);
    if (ry) {
      if (ry.binding.preventDefault !== false) e.preventDefault();
      yDispatch(ry.intent);
      return;
    }
    const rx = resolveBinding(xComposed.keymap(xStore.getState()), stroke, platform);
    if (rx) {
      if (rx.binding.preventDefault !== false) e.preventDefault();
      xDispatch(rx.intent);
    }
  };

  const dispatchPoint = (clientX: number, clientY: number) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const sx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * 100;
    const vy = (1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))) * 100;
    xDispatch(numberIntents.set({ value: sx }, "pointer"));
    yDispatch(numberIntents.set({ value: vy }, "pointer"));
  };

  const thumbColor = hsvToRgb({ h: hsva.h, s: hsva.s, v: hsva.v });

  return (
    <div
      ref={areaRef}
      role="slider"
      tabIndex={0}
      aria-label={labels.area}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsva.s)}
      aria-valuetext={`${labels.saturation} ${Math.round(hsva.s)} %, ${labels.brightness} ${Math.round(hsva.v)} %`}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dispatchPoint(e.clientX, e.clientY);
        e.currentTarget.focus();
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) dispatchPoint(e.clientX, e.clientY);
      }}
      className={cn(
        "relative h-44 w-full cursor-crosshair touch-none rounded-lg border border-border outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsva.h} 100% 50%))`,
      }}
    >
      <div
        aria-hidden
        className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{
          left: `${hsva.s}%`,
          top: `${100 - hsva.v}%`,
          background: rgbCss(thumbColor),
        }}
      />
    </div>
  );
}
