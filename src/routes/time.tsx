import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DateTimeField, DateTimePicker, TimeField } from "@/framework/primitives";
import {
  formatTime,
  hourCycleOf,
  toISODateTime,
  type DateTimeValue,
  type TimeValue,
} from "@/framework/core";
import { MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";

export const Route = createFileRoute("/time")({
  head: () => ({
    meta: [
      { title: "Temps — Forge" },
      {
        name: "description",
        content: "TimeField — TimeValue pur, cycle 12/24 h dérivé d'Intl, machine de segments.",
      },
    ],
  }),
  component: TimePage,
});

const LOCALES = [
  { tag: "en-US", label: "English (US)" },
  { tag: "fr-FR", label: "Français" },
  { tag: "ar-EG", label: "العربية (مصر)" },
] as const;

function TimePage() {
  const [shared, setShared] = useState<TimeValue | null>(null);
  const [withSeconds, setWithSeconds] = useState<TimeValue | null>(null);
  const [dateTime, setDateTime] = useState<DateTimeValue | null>(null);
  const [picked, setPicked] = useState<DateTimeValue | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Temps"
        description={
          <>
            Vague 8a : <code>TimeValue</code> pur ({"{hour, minute, second?}"}, stockage toujours
            0-23, arithmétique avec wrap — 23:59 + 1 min = 00:00), cycle 12/24 h{" "}
            <em>dérivé d&apos;Intl</em> (jamais deviné), et la machine <code>dateField</code>{" "}
            généralisée en <strong>machine de segments</strong> : dateField et timeField sont deux
            configurations du même reducer. AM/PM est un segment cyclique — flèches pour basculer,
            ou l&apos;initiale localisée (« a »/« p »).
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Tests Node ajoutés" value="48" unit="valeur + Intl + machine" accent />
        <MetricCard label="Machines nouvelles" value="1" unit="segments — dates et temps" />
        <MetricCard label="Date mutable dans l'état" value="0" unit="TimeValue pur" />
        <MetricCard label="Données de locale embarquées" value="0" unit="tout dérive d'Intl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="12 h vs 24 h — le cycle vient d'Intl, l'état reste 0-23"
          description={
            <>
              Trois champs, le <strong>même état contrôlé</strong> : en-US affiche 2:30 PM (cycle{" "}
              <code>{hourCycleOf("en-US")}</code>, segment AM/PM), fr affiche 14:30 (cycle{" "}
              <code>{hourCycleOf("fr-FR")}</code>, pas de segment), ar-EG passe en chiffres arabes
              et RTL. Tapez 2 30 p dans le premier — les deux autres affichent 14:30. Flèches ↑↓ =
              spinbutton avec wrap (23 → 0), « a »/« p » sur le segment AM/PM.
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {LOCALES.map((l) => (
              <div key={l.tag} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                  {l.label} <code className="text-[10px] opacity-70">{hourCycleOf(l.tag)}</code>
                </span>
                <TimeField
                  locale={l.tag}
                  value={shared}
                  onValueChange={setShared}
                  aria-label={`Heure (${l.tag})`}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {shared
                ? `Valeur (stockage 24 h) : ${formatTime(shared, "fr-FR")} — soit ${formatTime(shared, "en-US")}`
                : "Champ incomplet — change n'est émis qu'aux points de commit (AM/PM compris)."}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Secondes opt-in — absentes du type tant qu'on ne les demande pas"
          description={
            <>
              <code>showSeconds</code> ajoute le segment : la valeur composée porte alors{" "}
              <code>second</code>, sinon la propriété n&apos;existe pas (l&apos;arithmétique du core
              préserve cette présence). Le champ reste incomplet tant que les trois segments ne sont
              pas remplis.
            </>
          }
        >
          <div className="flex flex-col items-start gap-3">
            <TimeField
              locale="fr-FR"
              showSeconds
              value={withSeconds}
              onValueChange={setWithSeconds}
              aria-label="Heure avec secondes"
            />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {withSeconds ? `Valeur : ${formatTime(withSeconds, "fr-FR")}` : "Aucune valeur."}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="DateTimeField — deux instances de la même machine, un groupe ARIA"
          description={
            <>
              DateField + TimeField côte à côte, zéro logique nouvelle : chaque moitié garde sa
              saisie partielle, la valeur composée est <code>null</code> tant que les deux ne sont
              pas complètes, et <code>onValueChange</code> ne part qu&apos;aux vraies transitions
              (pas d&apos;écho de null pendant le remplissage).
            </>
          }
        >
          <div className="flex flex-col items-start gap-3">
            <DateTimeField
              locale="fr-FR"
              value={dateTime}
              onValueChange={setDateTime}
              aria-label="Date et heure"
            />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {dateTime ? `ISO : ${toISODateTime(dateTime)}` : "Composition incomplète."}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="DateTimePicker — calendrier + heure dans le même Overlay"
          description={
            <>
              Le pattern DatePicker étendu : choisir un jour dans la grille ne ferme pas
              l&apos;overlay — le TimeField en dessous prend le relais (premier choix sans heure →
              minuit, la valeur commit immédiatement). Échap ou clic dehors ferme et restaure le
              focus au déclencheur.
            </>
          }
        >
          <div className="flex flex-col items-start gap-3">
            <DateTimePicker
              locale="fr-FR"
              value={picked}
              onValueChange={setPicked}
              aria-label="Échéance"
            />
            <p className="text-xs text-muted-foreground">
              {picked ? toISODateTime(picked) : "Aucune échéance."}
            </p>
          </div>
        </Showcase>
      </div>
    </div>
  );
}
