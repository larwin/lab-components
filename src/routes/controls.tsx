import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Moon, Underline } from "lucide-react";
import type { Key } from "@/framework/core";
import {
  Button,
  Checkbox,
  Form,
  NumberField,
  RadioGroup,
  Slider,
  Switch,
  TextField,
  Toggle,
  ToggleGroup,
} from "@/framework/primitives";
import { MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/controls")({
  head: () => ({
    meta: [
      { title: "Form Controls — Forge" },
      {
        name: "description",
        content:
          "Checkbox, Switch, Radio, Toggle, TextField, NumberField, Slider — pure machines, thin shells.",
      },
    ],
  }),
  component: ControlsPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ControlsPage() {
  /* Checkbox mixed: un parent contrôlé par ses enfants. */
  const [fruits, setFruits] = useState({ pomme: true, poire: false, cerise: false });
  const checkedCount = Object.values(fruits).filter(Boolean).length;
  const parentState = checkedCount === 0 ? false : checkedCount === 3 ? true : ("mixed" as const);

  const [notifications, setNotifications] = useState(true);
  const [size, setSize] = useState<Key | null>("m");
  const [align, setAlign] = useState<Key[]>(["left"]);
  const [marks, setMarks] = useState<Key[]>(["bold"]);
  const [volume, setVolume] = useState(40);
  const [price, setPrice] = useState<number | null>(9.99);
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Form Controls"
        description={
          <>
            Toute la logique de ces contrôles vit dans des machines pures du core (composées de
            behaviors : Toggleable, NumericValue, Validatable, collection engine) testées en Node
            avant que les coquilles React n&apos;existent. À tester : tout au clavier, et les
            erreurs de validation annoncées au lecteur d&apos;écran.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Behaviors réutilisés" value="5" unit="existants" />
        <MetricCard label="Nouveaux behaviors" value="2" unit="validatable + numericValue" accent />
        <MetricCard label="Machines partagées" value="1" unit="NumberField = Slider" />
        <MetricCard label="Logique dans React" value="0" unit="ligne" accent />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="Checkbox — état mixed"
          description="Cochez/décochez les enfants : le parent passe par l'état mixed (aria-checked=mixed). Espace bascule, Entrée est ignoré (sémantique checkbox)."
        >
          <div className="flex flex-col gap-2">
            <Checkbox
              checked={parentState}
              onCheckedChange={() => {
                const next = parentState !== true;
                setFruits({ pomme: next, poire: next, cerise: next });
              }}
            >
              Tous les fruits
            </Checkbox>
            <div className="ml-6 flex flex-col gap-2 border-l border-border pl-4">
              {(Object.keys(fruits) as (keyof typeof fruits)[]).map((fruit) => (
                <Checkbox
                  key={fruit}
                  checked={fruits[fruit]}
                  onCheckedChange={(checked) =>
                    setFruits((f) => ({ ...f, [fruit]: checked === true }))
                  }
                >
                  <span className="capitalize">{fruit}</span>
                </Checkbox>
              ))}
            </div>
          </div>
        </Showcase>

        <Showcase
          title="Switch — même machine, role=switch"
          description="Exactement la même machine Focusable + Toggleable que la Checkbox ; seuls le rôle ARIA et le rendu changent. C'est la composition qui fait le composant."
        >
          <div className="flex flex-col gap-3">
            <Switch checked={notifications} onCheckedChange={setNotifications}>
              Notifications {notifications ? "activées" : "coupées"}
            </Switch>
            <Switch defaultChecked={false}>
              <span className="inline-flex items-center gap-1.5">
                <Moon className="size-3.5" /> Mode sombre (non contrôlé)
              </span>
            </Switch>
            <Switch disabled>Option verrouillée</Switch>
          </div>
        </Showcase>

        <Showcase
          title="RadioGroup — selection follows focus"
          description="Un seul tab stop : Tab entre dans le groupe sur la valeur cochée, les flèches déplacent ET cochent (pattern ARIA radiogroup), wrap aux extrémités. « XL » est désactivé : la navigation saute par-dessus."
        >
          <div className="flex flex-col gap-3">
            <RadioGroup
              aria-label="Taille"
              orientation="both"
              items={[
                { key: "s", label: "S", description: "Small" },
                { key: "m", label: "M", description: "Medium" },
                { key: "l", label: "L", description: "Large" },
                { key: "xl", label: "XL", description: "Rupture de stock", disabled: true },
              ]}
              value={size}
              onValueChange={setSize}
            />
            <p className="text-xs text-muted-foreground">
              Valeur : <span className="font-mono">{String(size)}</span>
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Toggle & ToggleGroup"
          description="Le groupe est le collection engine en orientation horizontale : flèches ← → pour le focus logique, Espace/Entrée pour presser. En mode single, represser l'actif le relâche (toggleOnSelect)."
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Toggle defaultPressed aria-label="Activer le gras">
                <Bold className="size-4" /> Toggle seul
              </Toggle>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <ToggleGroup
                aria-label="Alignement"
                mode="single"
                items={[
                  { key: "left", icon: <AlignLeft className="size-4" />, "aria-label": "Gauche" },
                  {
                    key: "center",
                    icon: <AlignCenter className="size-4" />,
                    "aria-label": "Centre",
                  },
                  { key: "right", icon: <AlignRight className="size-4" />, "aria-label": "Droite" },
                ]}
                value={align}
                onValueChange={setAlign}
              />
              <ToggleGroup
                aria-label="Style de texte"
                mode="multiple"
                items={[
                  { key: "bold", icon: <Bold className="size-4" />, "aria-label": "Gras" },
                  { key: "italic", icon: <Italic className="size-4" />, "aria-label": "Italique" },
                  {
                    key: "underline",
                    icon: <Underline className="size-4" />,
                    "aria-label": "Souligné",
                  },
                ]}
                value={marks}
                onValueChange={setMarks}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Alignement : <span className="font-mono">{align.join(", ") || "aucun"}</span> · Styles
              : <span className="font-mono">{marks.join(", ") || "aucun"}</span>
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Slider — clavier et pointeur, mêmes intents"
          description="Glissez au pointeur OU naviguez au clavier (flèches ±pas, Shift+flèche / PageUp ±gros pas, Home/End → min/max) : tout converge sur le même intent number/set — seule la source diffère dans le journal."
        >
          <div className="flex flex-col gap-5">
            <Slider
              aria-label="Volume"
              min={0}
              max={100}
              step={1}
              value={volume}
              onValueChange={setVolume}
              formatValue={(v) => `${v} %`}
            />
            <Slider
              aria-label="Budget"
              min={0}
              max={500}
              step={25}
              defaultValue={150}
              formatValue={(v) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            />
          </div>
        </Showcase>

        <Showcase
          title="NumberField — Intl.NumberFormat round-trip"
          description="La même machine NumericValue que le Slider, avec un profil clavier spinbutton (Home/End restent au caret). Tapez « 1 234,56 » ou « 12.5 » : le parseur localisé comprend les deux. Flèches ±1, Shift+flèche ±10, clamp min/max."
        >
          <div className="flex flex-col gap-4">
            <NumberField
              label="Quantité"
              description="Entre 0 et 100 — essayez de taper 250 puis Entrée : clamp."
              min={0}
              max={100}
              step={1}
              defaultValue={42}
            />
            <NumberField
              label="Prix unitaire"
              min={0}
              max={1000}
              step={0.5}
              locale="fr-FR"
              formatOptions={{ style: "currency", currency: "EUR" }}
              value={price}
              onValueChange={setPrice}
            />
          </div>
        </Showcase>
      </div>

      <div className="mt-6">
        <Showcase
          title="Form + Field — validation orchestrée"
          description="Chaque champ porte une machine Validatable (dirty/touched/error). La validation court au blur puis en continu ; les erreurs sont ANNONCÉES au lecteur d'écran (effet a11y/announce assertif émis par le reducer). Soumettez vide : tous les champs se valident, le focus saute sur la première erreur."
        >
          <Form
            onSubmit={() => setSubmitted(new Date().toLocaleTimeString("fr-FR"))}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap gap-4">
              <TextField
                label="Nom du projet"
                description="3 caractères minimum."
                required
                validate={(v) =>
                  v.trim().length > 0 && v.trim().length < 3 ? "Au moins 3 caractères" : null
                }
              />
              <TextField
                label="E-mail"
                type="email"
                required
                validate={(v) => (v !== "" && !EMAIL_RE.test(v) ? "Adresse e-mail invalide" : null)}
              />
              <NumberField
                label="Effectif"
                description="Requis, entre 1 et 50."
                min={1}
                max={50}
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary">
                Soumettre
              </Button>
              {submitted && (
                <p className="text-xs text-success">Formulaire valide — soumis à {submitted}</p>
              )}
            </div>
          </Form>
        </Showcase>
      </div>
    </div>
  );
}
