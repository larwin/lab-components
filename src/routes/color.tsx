import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  formatHex,
  formatOklch,
  formatRgb,
  hsvToRgb,
  wcagContrast,
  type HsvaColor,
  type RgbColor,
} from "@/framework/core";
// Leaf module on purpose (not in the barrel): only this route ships the table.
import { nearestNamedColor } from "@/framework/core/color/named";
import { ColorPicker, ToggleGroup } from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/components/primitives";

export const Route = createFileRoute("/color")({
  head: () => ({
    meta: [
      { title: "ColorPicker — Forge" },
      {
        name: "description",
        content: "ColorPicker : core/color pur, surface NumericValue ×2, contraste WCAG.",
      },
    ],
  }),
  component: ColorPage,
});

const SWATCHES = [
  { key: "brand", color: "#6366f1", label: "Indigo (marque)" },
  { key: "sky", color: "#0ea5e9", label: "Ciel" },
  { key: "emerald", color: "#10b981", label: "Émeraude" },
  { key: "amber", color: "#f59e0b", label: "Ambre" },
  { key: "rose", color: "#f43f5e", label: "Rose" },
  { key: "slate", color: "#475569", label: "Ardoise" },
  { key: "black", color: "#000000", label: "Noir" },
  { key: "white", color: "#ffffff", label: "Blanc" },
];

type OutputFormat = "hex" | "rgb" | "oklch";

const formatAs = (format: OutputFormat, rgb: RgbColor, alpha: number): string => {
  if (format === "hex") return formatHex(rgb, alpha);
  if (format === "rgb") return formatRgb(rgb, alpha);
  return formatOklch(rgb, alpha);
};

function ColorPage() {
  const [color, setColor] = useState<HsvaColor>({ h: 226, s: 60, v: 95, a: 1 });
  const [bg, setBg] = useState<HsvaColor>({ h: 0, s: 0, v: 100, a: 1 });
  const [format, setFormat] = useState<OutputFormat>("hex");
  const [lastAnnouncement, setLastAnnouncement] = useState("—");

  const colorName = (rgb: RgbColor): string => {
    const nearest = nearestNamedColor(rgb);
    const message = nearest.exact ? nearest.name : `proche de ${nearest.name}`;
    setLastAnnouncement(message);
    return message;
  };

  const rgb = hsvToRgb(color);
  const bgRgb = hsvToRgb(bg);
  const nearest = nearestNamedColor(rgb);
  const contrast = wcagContrast(rgb, bgRgb);
  const output = formatAs(format, rgb, color.a);

  const badge = (ok: boolean, label: string) => (
    <span
      key={label}
      className={
        ok
          ? "rounded-md bg-success/15 px-2 py-0.5 font-mono text-xs text-success"
          : "rounded-md bg-destructive/10 px-2 py-0.5 font-mono text-xs text-destructive line-through opacity-70"
      }
    >
      {label}
    </span>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="ColorPicker"
        description={
          <>
            Vague 9c : <code>core/color</code> pur et sans dépendance — conversions exactes RGB ↔
            HSL ↔ HSV et sRGB ↔ OKLCH (matrices OKLab écrites en dur, round-trip prouvé sur le cube
            RGB), parsing/formatage hex/rgb()/hsl()/oklch(), contraste WCAG, ΔE OK. AUCUNE machine
            couleur : la surface 2D = <strong>NumericValue ×2</strong> (6ᵉ et 7ᵉ réutilisations — un
            axe par machine), teinte/alpha = le Slider, hex = TextField, R/V/B = NumberField. Tout
            converge sur le même état HSV : la teinte survit à la saturation nulle.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Couleur" value={formatHex(rgb)} />
        <MetricCard
          label="Nom approché (ΔE OK)"
          value={nearest.name}
          unit={nearest.exact ? "exact" : `ΔE ${nearest.deltaE.toFixed(3)}`}
        />
        <MetricCard label="Contraste vs fond" value={contrast.ratio.toFixed(2)} unit=": 1" accent />
        <MetricCard label="Dernière annonce SR" value={lastAnnouncement} />
      </div>

      <div className="space-y-8">
        <Showcase
          title="Le picker complet — tout au clavier"
          description={
            <>
              Tab sur la surface : ←/→ = saturation (machine X, profil slider — Home/End = 0/100),
              ↑/↓ = luminosité (machine Y, profil spinbutton — Shift et PageUp/Down = ±10).
              L&apos;aria-valuetext annonce LES DEUX axes. Teinte et alpha sont des Sliders
              ordinaires ; le hex se valide à Entrée/blur (brouillon → commit) ; les swatches sont
              un ToggleGroup. Chaque commit annonce le nom CSS approché (module feuille importé par
              la démo seule, pattern windows-zones) — visible dans la carte ci-dessus.
            </>
          }
        >
          <div className="flex flex-wrap items-start gap-8">
            <ColorPicker
              value={color}
              onValueChange={setColor}
              swatches={SWATCHES}
              colorName={colorName}
            />
            <div className="flex min-w-56 flex-col gap-3">
              <ToggleGroup
                mode="single"
                aria-label="Format de sortie"
                items={[
                  { key: "hex", label: "Hex" },
                  { key: "rgb", label: "RGB" },
                  { key: "oklch", label: "OKLCH" },
                ]}
                value={[format]}
                onValueChange={(keys) => {
                  const next = keys[0] as OutputFormat | undefined;
                  if (next) setFormat(next);
                }}
              />
              <code className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
                {output}
              </code>
              <div
                className="h-24 rounded-lg border border-border"
                style={{
                  background: `linear-gradient(${formatRgb(rgb, color.a)}, ${formatRgb(rgb, color.a)}), repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%)`,
                  backgroundSize: "auto, 14px 14px",
                }}
              />
            </div>
          </div>
        </Showcase>

        <Showcase
          title="Vérificateur de contraste WCAG live"
          description={
            <>
              Deux couleurs, le ratio (luminance relative WCAG) et les quatre seuils en direct : AA
              normal ≥ 4,5 · AA large ≥ 3 · AAA normal ≥ 7 · AAA large ≥ 4,5. Le picker de gauche
              est le MÊME état contrôlé que le picker du haut.
            </>
          }
        >
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Texte
              </p>
              <ColorPicker value={color} onValueChange={setColor} showAlpha={false} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Fond
              </p>
              <ColorPicker value={bg} onValueChange={setBg} showAlpha={false} />
            </div>
            <div className="flex min-w-64 flex-col gap-3">
              <div
                className="flex h-32 flex-col items-center justify-center gap-1 rounded-lg border border-border px-4"
                style={{ background: formatRgb(bgRgb) }}
              >
                <p className="text-lg font-semibold" style={{ color: formatRgb(rgb) }}>
                  Texte d&apos;exemple
                </p>
                <p className="text-xs" style={{ color: formatRgb(rgb) }}>
                  Ratio {contrast.ratio.toFixed(2)} : 1
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {badge(contrast.aaNormal, "AA")}
                {badge(contrast.aaLarge, "AA large")}
                {badge(contrast.aaaNormal, "AAA")}
                {badge(contrast.aaaLarge, "AAA large")}
              </div>
            </div>
          </div>
        </Showcase>
      </div>
    </div>
  );
}
