import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  DateTimeField,
  DateTimePicker,
  TimeField,
  TimePicker,
  TimeZoneSelect,
  type TimePickerVariant,
} from "@/framework/primitives";
import {
  dateOf,
  dateValue,
  formatOffset,
  formatTime,
  formatZoned,
  hourCycleOf,
  timeOf,
  timeValue,
  timeZoneCity,
  timeZoneName,
  toISODateTime,
  withTimeZone,
  zonedDateTime,
  type DateTimeValue,
  type TimeValue,
} from "@/framework/core";
// Optional leaf module — imported directly, never through the core barrel.
import { ianaFromWindows, windowsFromIana } from "@/framework/core/time/windows-zones";
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

const VARIANTS: { variant: TimePickerVariant; label: string; hint: string }[] = [
  { variant: "segments", label: "Segments", hint: "le TimeField de la 8a, inline" },
  { variant: "columns", label: "Colonnes", hint: "machine Listbox par colonne, typeahead inclus" },
  { variant: "wheel", label: "Roue", hint: "snap + inertie purs ; clavier = la même Navigable" },
  { variant: "dial", label: "Cadran", hint: "NumericValue ; pointeur et flèches → number/set" },
];

function TimePage() {
  const [shared, setShared] = useState<TimeValue | null>(null);
  const [withSeconds, setWithSeconds] = useState<TimeValue | null>(null);
  const [dateTime, setDateTime] = useState<DateTimeValue | null>(null);
  const [picked, setPicked] = useState<DateTimeValue | null>(null);
  const [meeting, setMeeting] = useState<TimeValue | null>(timeValue(14, 30));
  const [pickerLocale, setPickerLocale] = useState("fr-FR");
  const [parisWall, setParisWall] = useState<DateTimeValue | null>({
    ...dateValue(2026, 7, 15),
    ...timeValue(18, 0),
  });
  const [targets, setTargets] = useState<string[]>(["America/New_York", "Asia/Tokyo"]);
  const sourceZoned = parisWall
    ? zonedDateTime(dateOf(parisWall), timeOf(parisWall), "Europe/Paris")
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Temps"
        description={
          <>
            Chantier temps & fuseaux (vagues 8a/8b/8c) : <code>TimeValue</code> pur (
            {"{hour, minute, second?}"}, stockage toujours 0-23, wrap à minuit), cycle 12/24 h{" "}
            <em>dérivé d&apos;Intl</em> (jamais deviné), la machine <code>dateField</code>{" "}
            généralisée en <strong>machine de segments</strong> (dates et temps = deux
            configurations du même reducer), le TimePicker à quatre rendus sans machine nouvelle, et{" "}
            <code>ZonedDateTime</code> pur — offsets IANA calculés via Intl, DST par construction,
            zéro donnée embarquée.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Tests Node ajoutés"
          value="76"
          unit="valeur + Intl + machine + géométrie + fuseaux"
          accent
        />
        <MetricCard label="Machines nouvelles (8b/8c)" value="0" unit="N rendus, mêmes machines" />
        <MetricCard
          label="Données de fuseau embarquées"
          value="0"
          unit="offsets calculés via Intl"
        />
        <MetricCard label="Données de locale embarquées" value="0" unit="tout dérive d'Intl" />
      </div>

      <Showcase
        title="TimePicker — UNE machine, QUATRE rendus (vague 8b)"
        description={
          <>
            Les quatre variantes éditent le <strong>même état contrôlé</strong> et ne contiennent
            aucune logique nouvelle : <em>segments</em> est le TimeField, <em>colonnes</em> et{" "}
            <em>roue</em> sont la composition listbox [Focusable + Navigable + Selectable] par
            colonne (la roue ajoute <code>selectionFollowsFocus</code> : les flèches la font
            tourner), le <em>cadran</em> est la machine NumericValue profil slider — pointeur et
            flèches convergent sur le même intent <code>number/set</code>, le pattern Slider. Ce qui
            change est de la géométrie pure testée en Node : snap + inertie de la roue (offset →
            index), angle ↔ valeur du cadran (bague intérieure 13-00 en h23, aimantation au pas).
            Changez l&apos;heure dans une variante : les trois autres suivent. Basculez la locale :
            le cadran h23 a deux bagues, le h12 un sélecteur AM/PM.
          </>
        }
        className="mb-6"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label="Locale du picker"
              className="inline-flex rounded-md border border-border p-0.5"
            >
              {["fr-FR", "en-US"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={pickerLocale === tag}
                  onClick={() => setPickerLocale(tag)}
                  className={
                    pickerLocale === tag
                      ? "rounded bg-primary px-2.5 py-1 text-xs text-primary-foreground"
                      : "rounded px-2.5 py-1 text-xs hover:bg-muted"
                  }
                >
                  {tag} · {hourCycleOf(tag)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              État partagé :{" "}
              {meeting ? formatTime(meeting, pickerLocale) : "aucune heure sélectionnée"} ·
              minuteStep 5 · bornes 08:00-18:55 · 12 h-13 h désactivées (déjeuner)
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {VARIANTS.map(({ variant, label, hint }) => (
              <div
                key={variant}
                className="flex flex-col items-start gap-2 rounded-lg border border-border p-3"
              >
                <p className="text-xs font-medium">
                  {label} <span className="font-normal text-muted-foreground">— {hint}</span>
                </p>
                <TimePicker
                  key={pickerLocale}
                  variant={variant}
                  locale={pickerLocale}
                  value={meeting}
                  onValueChange={setMeeting}
                  minuteStep={5}
                  min={timeValue(8, 0)}
                  max={timeValue(18, 55)}
                  isTimeDisabled={(t) => t.hour === 12}
                  aria-label={`Heure de réunion (${label})`}
                />
              </div>
            ))}
          </div>
        </div>
      </Showcase>

      <Showcase
        title="Fuseaux — le même instant à Paris, New York, Tokyo (vague 8c)"
        description={
          <>
            <code>ZonedDateTime</code> pur : l&apos;offset d&apos;un instant dans un fuseau IANA est{" "}
            <em>calculé</em> via <code>Intl.DateTimeFormat</code> (timeZoneName « longOffset ») —
            zéro donnée de fuseau embarquée, DST juste par construction. La preuve : basculez
            été/hiver — Tokyo (sans DST) passe de +7 h à +8 h par rapport à Paris, New York reste à
            −6 h (les deux basculent). Le 29 mars 2026 à 02:30 n&apos;existe pas à Paris : le champ
            retombe sur 03:30 (résolution « compatible » de Temporal). Ajoutez un fuseau via le
            TimeZoneSelect — le ComboBox existant tel quel, recherche culture-aware sur ville et
            libellé localisé, liste triée par offset.
          </>
        }
        className="mb-6"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <DateTimeField
              locale="fr-FR"
              value={parisWall}
              onValueChange={setParisWall}
              aria-label="Heure murale à Paris"
            />
            <div
              role="group"
              aria-label="Préréglages saison"
              className="inline-flex rounded-md border border-border p-0.5"
            >
              <button
                type="button"
                onClick={() => setParisWall({ ...dateValue(2026, 7, 15), ...timeValue(18, 0) })}
                className="rounded px-2.5 py-1 text-xs hover:bg-muted"
              >
                Été (15 juil.)
              </button>
              <button
                type="button"
                onClick={() => setParisWall({ ...dateValue(2026, 1, 15), ...timeValue(18, 0) })}
                className="rounded px-2.5 py-1 text-xs hover:bg-muted"
              >
                Hiver (15 janv.)
              </button>
              <button
                type="button"
                onClick={() => setParisWall({ ...dateValue(2026, 3, 29), ...timeValue(2, 30) })}
                className="rounded px-2.5 py-1 text-xs hover:bg-muted"
              >
                Trou DST (29 mars 02:30)
              </button>
            </div>
            <TimeZoneSelect
              locale="fr-FR"
              referenceEpochMs={Date.UTC(2026, 6, 15)}
              onValueChange={(zone) => {
                if (zone && !targets.includes(zone)) setTargets((t) => [...t, zone]);
              }}
              aria-label="Ajouter un fuseau"
            />
          </div>
          {sourceZoned && (
            <div className="overflow-hidden rounded-lg border border-border">
              {["Europe/Paris", ...targets].map((zone) => {
                const zdt = withTimeZone(sourceZoned, zone);
                const windowsId = windowsFromIana(zone);
                return (
                  <div
                    key={zone}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="w-40 shrink-0 font-medium">{timeZoneCity(zone)}</span>
                    <span className="font-mono tabular-nums">
                      {formatZoned(zdt, "fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatOffset(zdt.offsetMinutes)} · {timeZoneName(zone, "fr-FR", "long")}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      Windows : {windowsId ?? "—"}
                      {windowsId && ianaFromWindows(windowsId) !== zone && (
                        <> (canonique : {ianaFromWindows(windowsId)})</>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            La colonne Windows vient du module optionnel <code>core/time/windows-zones</code> —
            généré depuis la table CLDR windowsZones (139 ids, 500 entrées), versionné dans le repo,
            jamais importé par le reste du core (tree-shakable). Régénération :{" "}
            <code>bun scripts/generate-windows-zones.ts</code>.
          </p>
        </div>
      </Showcase>

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
