import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, DateField, DatePicker, DateRangePicker } from "@/framework/primitives";
import {
  addDays,
  dayOfWeek,
  firstDayOfWeek,
  formatDate,
  weekdayNames,
  type DateRange,
  type DateValue,
} from "@/framework/core";
import { MetricCard, PageHeader, Showcase } from "@/playground/components/primitives";
import { cn } from "@/shared/lib/utils";

export const Route = createFileRoute("/dates")({
  head: () => ({
    meta: [
      { title: "Dates — Forge" },
      {
        name: "description",
        content: "Calendar — DateValue pur, machine calendarGrid, i18n Intl (fr/en/ar).",
      },
    ],
  }),
  component: DatesPage,
});

const LOCALES = [
  { tag: "fr-FR", label: "Français" },
  { tag: "en-US", label: "English (US)" },
  { tag: "ar-EG", label: "العربية (مصر)" },
] as const;

const CALENDAR_LABELS: Record<
  string,
  { previousMonth: string; nextMonth: string; previousYear: string; nextYear: string }
> = {
  "fr-FR": {
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    previousYear: "Année précédente",
    nextYear: "Année suivante",
  },
  "en-US": {
    previousMonth: "Previous month",
    nextMonth: "Next month",
    previousYear: "Previous year",
    nextYear: "Next year",
  },
  "ar-EG": {
    previousMonth: "الشهر السابق",
    nextMonth: "الشهر التالي",
    previousYear: "السنة السابقة",
    nextYear: "السنة التالية",
  },
};

const today = (): DateValue => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
};

function LocaleSwitch({ value, onChange }: { value: string; onChange: (tag: string) => void }) {
  return (
    <div
      role="group"
      aria-label="Locale"
      className="inline-flex rounded-md border border-border p-0.5"
    >
      {LOCALES.map((l) => (
        <button
          key={l.tag}
          type="button"
          aria-pressed={value === l.tag}
          onClick={() => onChange(l.tag)}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            value === l.tag ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function DatesPage() {
  const [locale, setLocale] = useState<string>("fr-FR");
  const [picked, setPicked] = useState<DateValue | null>(null);
  const [shared, setShared] = useState<DateValue | null>(null);
  const [fieldDate, setFieldDate] = useState<DateValue | null>(null);
  const [pickedViaPicker, setPickedViaPicker] = useState<DateValue | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);

  const fdow = firstDayOfWeek(locale);
  const min = addDays(today(), -10);
  const max = addDays(today(), 10);

  return (
    <div>
      <PageHeader
        eyebrow="Next-Gen Engine"
        title="Dates"
        description={
          <>
            Vagues 7a + 7b : <code>DateValue</code> pur ({"{year, month, day}"}, aucun{" "}
            <code>Date</code> dans l&apos;état — arithmétique civile exacte), services Intl sans
            données embarquées, machine <code>calendarGrid</code> (clavier : ←→↑↓, Home/End,
            PageUp/Down, Shift = année) avec sélection d&apos;intervalle (ancre + survol = preview,
            Échap annule l&apos;ancre), et machine <code>dateField</code> : segments jour/mois/année
            dans l&apos;ordre de la locale (Intl formatToParts), spinbuttons aux flèches, saisie
            directe avec auto-avance — le pattern PIN adulte.
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Tests Node ajoutés"
          value="68"
          unit="machines + arithmétique + Intl"
          accent
        />
        <MetricCard label="Date mutable dans l'état" value="0" unit="DateValue pur" />
        <MetricCard label="Données de locale embarquées" value="0" unit="tout dérive d'Intl" />
        <MetricCard label="Machines pures" value="2" unit="calendarGrid + dateField" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="i18n Intl — la preuve par trois locales"
          description={
            <>
              Changez de locale : le premier jour de semaine bouge (lundi fr · dimanche en-US ·
              samedi ar-EG), les en-têtes et chiffres se localisent, la grille passe en RTL et ←/→
              s&apos;inversent dans la keymap. Premier jour ici :{" "}
              {weekdayNames(locale, "long")[fdow]}.
            </>
          }
        >
          <div className="flex flex-col items-start gap-4">
            <LocaleSwitch value={locale} onChange={setLocale} />
            <Calendar
              key={locale}
              locale={locale}
              labels={CALENDAR_LABELS[locale]}
              value={picked}
              onValueChange={setPicked}
              aria-label="Calendrier multilingue"
            />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {picked
                ? `Sélection : ${formatDate(picked, locale, { dateStyle: "full" })}`
                : "Aucune date sélectionnée."}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Bornes min/max — focus clampé, jamais bloqué"
          description={
            <>
              Bornes à ±10 jours d&apos;aujourd&apos;hui : les flèches et PageUp/Down{" "}
              <em>clampent</em> le focus sur la borne au lieu de sortir ; les dates au-delà sont
              grisées et insélectionnables. La machine lit min/max par getters live.
            </>
          }
        >
          <Calendar locale="fr-FR" min={min} max={max} aria-label="Calendrier borné" />
        </Showcase>

        <Showcase
          title="Dates désactivées — focalisables, pas sélectionnables"
          description={
            <>
              Les week-ends sont désactivés via <code>isDateDisabled</code>. Conformément à
              l&apos;APG, le focus clavier les traverse (pas de trou de navigation) mais Entrée/clic
              n&apos;émettent rien.
            </>
          }
        >
          <Calendar
            locale="fr-FR"
            isDateDisabled={(d) => {
              const dow = dayOfWeek(d);
              return dow === 0 || dow === 6;
            }}
            aria-label="Calendrier jours ouvrés"
          />
        </Showcase>

        <Showcase
          title="DateField — segments dans l'ordre de la locale"
          description={
            <>
              L&apos;ordre vient d&apos;<code>Intl.formatToParts</code> : jj/mm/aaaa en français,
              mm/jj/aaaa en anglais US, chiffres arabes en ar-EG. Tapez les chiffres (auto-avance :
              « 4 » ne peut être que 04), flèches ↑↓ = spinbutton avec wrap (28 février → 1ᵉʳ), ←→
              entre segments, Backspace efface puis recule. Chaque segment est un{" "}
              <code>role=spinbutton</code> étiqueté via Intl.DisplayNames.
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {LOCALES.map((l) => (
              <div key={l.tag} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{l.label}</span>
                <DateField
                  locale={l.tag}
                  value={fieldDate}
                  onValueChange={setFieldDate}
                  aria-label={`Date (${l.tag})`}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {fieldDate
                ? `Valeur : ${formatDate(fieldDate, "fr", { dateStyle: "full" })}`
                : "Champ incomplet — change n'est émis qu'aux points de commit."}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="DatePicker — champ + calendrier dans un Overlay"
          description={
            <>
              Le pattern Select : une machine Dismissable possède l&apos;ouverture, la fermeture
              restaure le focus au déclencheur (effet <code>dom/restore-focus</code>). Champ et
              grille éditent la même valeur : tapez une date puis ouvrez le calendrier — il est déjà
              positionné dessus.
            </>
          }
        >
          <div className="flex flex-col items-start gap-3">
            <DatePicker
              locale="fr-FR"
              value={pickedViaPicker}
              onValueChange={setPickedViaPicker}
              aria-label="Date de livraison"
            />
            <p className="text-xs text-muted-foreground">
              {pickedViaPicker
                ? formatDate(pickedViaPicker, "fr", { dateStyle: "full" })
                : "Aucune date."}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="DateRangePicker — intervalle : ancre + survol = preview"
          description={
            <>
              Premier clic = ancre (annoncée SR), le survol ou les flèches étendent la preview en
              direct (dérivation pure <code>calendarRange</code>), second clic valide —{" "}
              <em>toujours ordonné</em> : choisissez la fin avant le début, la machine échange.
              Échap annule l&apos;ancre (binding qui laisse passer la touche sinon — l&apos;overlay
              garde Échap). Les deux champs imposent aussi début ≤ fin par échange.
            </>
          }
        >
          <div className="flex flex-col items-start gap-3">
            <DateRangePicker locale="fr-FR" value={range} onValueChange={setRange} />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {range
                ? `Du ${formatDate(range.start, "fr")} au ${formatDate(range.end, "fr")}`
                : "Aucun intervalle complet."}
            </p>
          </div>
        </Showcase>

        <Showcase
          title="Contrôlé & non-contrôlé — la machine reste la source de vérité"
          description={
            <>
              Deux calendriers partagent le même état React contrôlé : sélectionner dans l&apos;un
              synchronise l&apos;autre par un intent <code>program</code> silencieux (zéro vol de
              focus, zéro écho d&apos;événement).
            </>
          }
        >
          <div className="flex flex-wrap gap-4">
            <Calendar
              locale="fr-FR"
              value={shared}
              onValueChange={setShared}
              aria-label="Calendrier A"
            />
            <Calendar
              locale="en-US"
              value={shared}
              onValueChange={setShared}
              aria-label="Calendar B"
            />
          </div>
        </Showcase>
      </div>
    </div>
  );
}
