import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Boxes,
  Brush,
  Check,
  Cpu,
  DatabaseZap,
  FileText,
  FlaskConical,
  Grid3x3,
  Layers,
  PanelTopOpen,
  SlidersHorizontal,
  SquareKanban,
  TestTube2,
  TextCursorInput,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Showcase, CodeBlock } from "@/playground/components/primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — Next-Gen Component Engine" },
      {
        name: "description",
        content:
          "Architecture nouvelle génération : un cœur pur (Intent → Reducer → State → Effects), des behaviors composables, et React comme simple adaptateur.",
      },
    ],
  }),
  component: Home,
});

/* ------------------------------------------------------------------ */
/* Ce qui a été construit : les 7 démos nouvelle génération            */
/* ------------------------------------------------------------------ */

interface DemoCard {
  to: string;
  icon: LucideIcon;
  title: string;
  what: string;
  verify: string[];
}

const NEXT_GEN_DEMOS: DemoCard[] = [
  {
    to: "/engine",
    icon: Cpu,
    title: "Engine Inspector",
    what: "La fenêtre sur le cœur : chaque composant est une machine pure Intent → Reducer → State → Effects. Le journal montre tout en direct.",
    verify: [
      "Cliquez / naviguez au clavier dans le Listbox : chaque action devient un intent visible (avec sa source : keyboard, pointer…)",
      "Appuyez sur Mod+J sans focaliser le bouton : il se déclenche par raccourci global (source « shortcut »)",
      "Tapez « ra » dans le Listbox : la recherche typeahead saute sur Raspberry",
    ],
  },
  {
    to: "/grid-next",
    icon: Grid3x3,
    title: "DataGrid Next",
    what: "Une grille tableur complète sur machine pure : 500 000 lignes virtualisées, tri multi-colonnes, édition inline, clipboard, colonnes, groupement.",
    verify: [
      "Passez à 500 000 lignes puis triez : Shift+clic sur un 2ᵉ en-tête = multi-tri",
      "F2 / double-clic / tapez directement pour éditer Price (Entrée valide ↓, Tab →, Échap annule)",
      "Sélectionnez des lignes (Espace, Shift+flèche) puis Ctrl+C : TSV collable dans Excel",
      "Groupez par Category → Status : agrégats ⌀ prix et Σ stock par groupe",
      "Glissez le bord d'un en-tête (resize), glissez l'en-tête (réordonner), épinglez-le (pin sticky)",
    ],
  },
  {
    to: "/controls",
    icon: SlidersHorizontal,
    title: "Form Controls",
    what: "Les contrôles de formulaire classiques en compositions de behaviors : Checkbox/Switch (même machine), RadioGroup sur le collection engine, NumberField et Slider sur la même machine NumericValue, validation Validatable annoncée aux lecteurs d'écran.",
    verify: [
      "Tab dans le RadioGroup : l'entrée se fait sur la valeur cochée, les flèches déplacent ET cochent (wrap inclus, XL désactivé sauté)",
      "Dans NumberField Prix, tapez « 1 234,56 » puis Tab : parsing fr-FR, affichage 1 234,56 € — flèches ±0,5, Shift+flèche ±5",
      "Sur le Slider, glissez puis prenez le clavier : pointeur et flèches convergent sur le même intent number/set",
      "Soumettez le formulaire vide : chaque erreur est annoncée (live region assertive) et le focus saute au premier champ invalide",
    ],
  },
  {
    to: "/inputs-advanced",
    icon: TextCursorInput,
    title: "Saisie avancée",
    what: "TextArea, SearchField, TagsInput, Rating et PinInput — toujours zéro logique dans les coquilles : Escape qui vide la recherche est un binding déclaratif, les chips du TagsInput sont un second Navigable horizontal avec un nœud sentinelle pour l'input, le PinInput est une machine dédiée au curseur de segment.",
    verify: [
      "SearchField : tapez puis Escape (vide la requête) ; champ vide, Escape traverse — c'est le binding qui retourne null",
      "TagsInput : Backspace sur champ vide focalise le dernier chip, ← → naviguent, Backspace retire et focalise le voisin",
      "PinInput : collez « 12-34 56 » — la machine sanitise et répartit ; la complétion émet l'événement complete (toast)",
      "TextArea : approchez 120 caractères — compteur en avertissement + annonce SR « N caractères restants » une seule fois",
    ],
  },
  {
    to: "/disclosure",
    icon: PanelTopOpen,
    title: "Navigation & Disclosure",
    what: "Tabs, Accordion, Select et ContextMenu sans nouvelle logique : le collection engine et la machine Menu existants, recomposés. Le mode manuel/automatique des Tabs est un flag de config, le mode single de l'Accordion est résolu dans le reducer.",
    verify: [
      "Tabs : passez en « Manuel » — les flèches ne font plus que déplacer le focus, Entrée active",
      "Select : ouvrez et tapez « en » — le typeahead saute sur Enterprise (Legacy désactivé est sauté)",
      "Accordion single : ouvrir une section ferme l'autre ; ↑ ↓ naviguent entre les en-têtes",
      "Clic droit dans la zone ContextMenu : ouverture à la position du curseur, Échap referme et restaure le focus",
    ],
  },
  {
    to: "/overlays",
    icon: Layers,
    title: "Overlay System",
    what: "Un seul moteur (portal, pile de layers, focus trap, positionnement pur) derrière Menu, ComboBox, Dialog, Tooltip, Popover et Command Palette.",
    verify: [
      "Appuyez sur Mod+K n'importe où : la palette s'ouvre ; « Toggle theme » change vraiment le thème",
      "Ouvrez le Dialog puis réessayez Mod+K : masqué par le scope bloquant de la modale",
      "Dans le ComboBox, tapez « eta » : trouve « États-Unis » (matching culture-aware)",
      "Échap / clic extérieur ferme et restaure le focus sur le déclencheur",
    ],
  },
  {
    to: "/feedback",
    icon: BellRing,
    title: "Feedback",
    what: "La file de toasts est une machine pure : éviction au-delà du plafond, annonces lecteur d'écran et timers émis comme effets déclaratifs — le setTimeout vit dans l'adaptateur, le core n'a pas d'horloge. Progress et Meter complètent avec l'ARIA natif correct.",
    verify: [
      "Spammez « Info » : au-delà de 4 toasts, le plus ancien est évincé et son timer annulé par le reducer",
      "L'erreur est sticky (duration null) et annoncée en assertif ; les autres en polite",
      "Lancez l'upload simulé : le progressbar est déterminé (aria-valuenow), et la fin enfile un toast succès",
      "Glissez le slider disque : le Meter change de zone (vert → orange → rouge), sémantique du <meter> natif",
    ],
  },
  {
    to: "/data-loader",
    icon: DatabaseZap,
    title: "Data Loader",
    what: "La donnée asynchrone comme machine pure : les réponses obsolètes sont rejetées par le reducer — les courses de requêtes sont impossibles par construction.",
    verify: [
      "Tapez vite dans le filtre : chaque frappe annule la requête en vol (compteur « Aborted »)",
      "Triez une colonne : reset + refetch côté « serveur » (latence simulée réelle)",
      "Scrollez en bas : page suivante chargée automatiquement (infinite scroll)",
    ],
  },
  {
    to: "/kanban",
    icon: SquareKanban,
    title: "Kanban",
    what: "Le drag & drop est une machine : pointeur et clavier convergent sur les mêmes intents, avec annonces lecteur d'écran émises par le reducer.",
    verify: [
      "Glissez une carte à la souris entre les colonnes",
      "Au clavier : Tab sur une carte, Espace pour la saisir, ← → ↑ ↓ pour viser, Espace pour déposer, Échap pour annuler",
      "Ouvrez /engine dans un autre onglet : les intents drag/* défilent pendant le drag",
    ],
  },
  {
    to: "/canvas-grid",
    icon: Brush,
    title: "Canvas Grid",
    what: "La preuve finale : la même machine de grille et le même virtualizer peints sur un canvas, sans React dans le chemin de rendu (garanti par un test d'architecture).",
    verify: [
      "Passez à 1 000 000 de lignes : ~1-2 ms de paint par frame, seules ~15 lignes sont peintes",
      "Tout fonctionne pareil : tri par clic d'en-tête, navigation clavier tableur, sélections",
      "React DevTools : un seul composant sur toute la grille",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Avant / Après                                                       */
/* ------------------------------------------------------------------ */

const COMPARISON: { capability: string; before: string | false; after: string }[] = [
  {
    capability: "Logique testable sans navigateur",
    before: false,
    after: "~120 tests du cœur tournent en Node pur — ni DOM, ni React, ni jsdom",
  },
  {
    capability: "Architecture des composants",
    before: "useState locaux, logique dupliquée dans chaque composant",
    after: "Machines pures composées de behaviors (Listbox = Focusable + Navigable + Selectable)",
  },
  {
    capability: "Clavier",
    before: "switch impératifs sur e.key, focus DOM manuel",
    after: "Keymaps déclaratives (« Mod+A », « Shift+ArrowDown ») + raccourcis globaux avec scopes",
  },
  {
    capability: "Virtualisation",
    before: "Démo manuelle à hauteur fixe, focus cassé hors écran",
    after: "Arbre de Fenwick O(log n), hauteurs dynamiques, focus logique compatible 1M lignes",
  },
  {
    capability: "Grille",
    before: "Tri mono-colonne + filtre + sélection",
    after:
      "Multi-tri, édition, clipboard, colonnes pin/resize/reorder, groupement + agrégats, mode serveur",
  },
  {
    capability: "Overlays (menus, dialogs…)",
    before: "Composants Radix tiers, sans moteur commun",
    after: "Moteur propre : pile de layers, focus trap, positionnement pur testé, scopes bloquants",
  },
  {
    capability: "Données asynchrones",
    before: false,
    after:
      "Loader machine : courses impossibles par construction, annulation, pagination par curseur",
  },
  {
    capability: "Drag & drop",
    before: false,
    after: "Machine pure pointeur + clavier, annonces SR, Kanban accessible",
  },
  {
    capability: "Observabilité",
    before: false,
    after: "Journal de transitions + bus inspecteur global (/engine), time-travel",
  },
  {
    capability: "Indépendance du framework",
    before: false,
    after: "Deux renderers sur le même cœur : React et canvas — gardé par un test de pureté en CI",
  },
];

/* ------------------------------------------------------------------ */
/* Les preuves dans le code                                            */
/* ------------------------------------------------------------------ */

const PROOFS = [
  {
    path: "docs/RFC-001-NEXT-GEN-ARCHITECTURE.md",
    label:
      "Le document d'architecture : analyse de l'existant, principes, décisions, statut de chaque brique",
  },
  {
    path: "src/framework/core/",
    label:
      "Le cœur pur — runtime, behaviors, collection engine, raccourcis, virtualizer, query, dnd, i18n. Zéro import React",
  },
  {
    path: "src/framework/react/",
    label:
      "L'adaptateur React : useMachine, interpréteurs d'effets, Overlay, useVirtualizer, useDataSource",
  },
  {
    path: "src/framework/primitives/",
    label:
      "Les composants composés : Button, Listbox, TreeView, Menu, ComboBox, CommandPalette, Dialog, Tooltip, Popover, DataGrid, Kanban",
  },
  {
    path: "src/framework/canvas/",
    label: "Le second renderer (canvas) — mêmes machines, zéro React",
  },
  {
    path: "src/framework/core/purity.test.ts",
    label: "Le test d'architecture qui échoue si core/ ou canvas/ importent React",
  },
];

/* ------------------------------------------------------------------ */
/* L'existant conservé (gen 1)                                         */
/* ------------------------------------------------------------------ */

const LEGACY_PAGES = [
  { to: "/components", label: "Components", note: "catalogue gen 1 (Button, Checkbox, Input…)" },
  { to: "/collections", label: "Collections", note: "List / Tree / Menu gen 1, logique locale" },
  { to: "/data-grid", label: "Data Grid", note: "la grille d'origine : tri simple + filtre" },
  { to: "/virtualization", label: "Virtualization", note: "la démo manuelle d'origine" },
  { to: "/accessibility", label: "Accessibility", note: "page a11y d'origine" },
  { to: "/theming", label: "Theming", note: "tokens & dark mode (partagés)" },
  { to: "/debug", label: "Debug", note: "logs d'événements gen 1" },
];

function Home() {
  return (
    <div className="space-y-12">
      {/* ---- Hero ---- */}
      <section className="bg-grid relative overflow-hidden rounded-2xl border border-border bg-card p-10">
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            v2 · next-gen engine · 138 tests verts · lint 0 erreur
          </span>
          <h1 className="mt-5 font-sans text-5xl font-bold tracking-tight">
            Le moteur <span className="text-gradient-brand">Forge</span> nouvelle génération
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Un cœur 100 % pur —{" "}
            <span className="font-mono text-sm">Intent → Reducer → State → Effects</span> — où
            chaque composant est une composition de behaviors, et où React n'est qu'un adaptateur
            parmi d'autres (le canvas en est la preuve). Tout ce qui est marqué <Badge kind="new" />{" "}
            ci-dessous a été construit sur ce socle ; les pages <Badge kind="legacy" /> montrent
            l'état antérieur du projet, conservé pour comparaison.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/engine"
              className="inline-flex items-center gap-2 rounded-md [background-image:var(--gradient-brand)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Voir le moteur en direct <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/canvas-grid"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Brush className="size-4" /> 1M de lignes sur canvas
            </Link>
          </div>
        </div>
        <Boxes className="pointer-events-none absolute -top-8 -right-8 size-64 text-primary/5" />
      </section>

      {/* ---- Parcours de vérification rapide ---- */}
      <Showcase
        title="Vérifier en 3 minutes"
        description="Le chemin le plus court pour constater que tout est réel."
      >
        <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: "Ouvrez /engine et cliquez n'importe où : chaque interaction devient un intent journalisé, avec ses effets.",
              to: "/engine",
            },
            {
              step: "Sur /grid-next, passez à 500 000 lignes, triez, éditez une cellule (F2), copiez une sélection (Ctrl+C).",
              to: "/grid-next",
            },
            {
              step: "Appuyez sur Mod+K depuis /overlays, puis ouvrez le Dialog et constatez que Mod+K est masqué.",
              to: "/overlays",
            },
            {
              step: "Lancez `bun run test` : 138 tests, dont le cœur entier en Node pur (cherchez @vitest-environment node).",
              to: null,
            },
          ].map((item, i) => (
            <li
              key={i}
              className="relative rounded-lg border border-border bg-surface p-4 leading-relaxed"
            >
              <span className="absolute -top-2.5 left-3 rounded-full [background-image:var(--gradient-brand)] px-2 font-mono text-[11px] font-bold text-primary-foreground">
                {i + 1}
              </span>
              {item.step}{" "}
              {item.to && (
                <Link
                  to={item.to}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  → y aller
                </Link>
              )}
            </li>
          ))}
        </ol>
      </Showcase>

      {/* ---- Les démos next-gen ---- */}
      <section>
        <SectionTitle
          icon={FlaskConical}
          title="Ce qui a été construit"
          subtitle="Six démos, toutes sur le même cœur pur. Chaque carte liste exactement quoi tester."
          badge="new"
        />
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {NEXT_GEN_DEMOS.map((demo) => (
            <Link
              key={demo.to}
              to={demo.to}
              className="group rounded-xl border border-primary/30 bg-card p-5 transition-colors hover:border-primary/70 hover:bg-accent/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg [background-image:var(--gradient-brand)] text-primary-foreground">
                  <demo.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-sans text-base font-semibold">{demo.title}</h3>
                    <Badge kind="new" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{demo.to}</span>
                </div>
                <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{demo.what}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {demo.verify.map((v, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Avant / Après ---- */}
      <section>
        <SectionTitle
          icon={TestTube2}
          title="Avant / Après"
          subtitle="Ce que le projet faisait avant cette session, et ce qu'il fait maintenant."
        />
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_1fr_1.4fr] border-b border-border bg-muted/60 px-4 py-2.5 text-xs font-semibold tracking-wide uppercase">
            <span>Capacité</span>
            <span className="flex items-center gap-1.5">
              <Badge kind="legacy" /> Avant
            </span>
            <span className="flex items-center gap-1.5">
              <Badge kind="new" /> Maintenant
            </span>
          </div>
          {COMPARISON.map((row) => (
            <div
              key={row.capability}
              className="grid grid-cols-[1fr_1fr_1.4fr] gap-x-4 border-b border-border/60 px-4 py-3 text-sm last:border-b-0"
            >
              <span className="font-medium">{row.capability}</span>
              <span className="flex items-start gap-1.5 text-muted-foreground">
                {row.before === false ? (
                  <>
                    <X className="mt-0.5 size-3.5 shrink-0 text-destructive/70" />
                    <span className="italic">absent</span>
                  </>
                ) : (
                  <span className="text-xs leading-relaxed">{row.before}</span>
                )}
              </span>
              <span className="flex items-start gap-1.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                <span className="text-xs leading-relaxed">{row.after}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Preuves dans le code ---- */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Showcase
          title="Les preuves dans le code"
          description="Où regarder dans le dépôt pour vérifier chaque affirmation."
        >
          <ul className="flex flex-col gap-2">
            {PROOFS.map((proof) => (
              <li
                key={proof.path}
                className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <code className="font-mono text-xs font-semibold">{proof.path}</code>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {proof.label}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Showcase>

        <Showcase
          title="Tout vérifier en ligne de commande"
          description="Les trois commandes qui valident l'ensemble."
        >
          <CodeBlock
            label="terminal"
            code={`bun run test    # 138 tests — le cœur tourne en Node pur,
                # sans DOM ni React (purity.test.ts garde la frontière)
bun run lint    # 0 erreur
bun run build   # build de production OK`}
          />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Les tests du cœur (behaviors, collection, raccourcis, virtualizer Fenwick, loader async,
            drag machine, machine de grille…) portent l'annotation{" "}
            <code className="font-mono">@vitest-environment node</code> : la promesse « testable
            sans navigateur » n'est pas déclarative, elle est exécutée à chaque CI.
          </p>
        </Showcase>
      </section>

      {/* ---- L'existant conservé ---- */}
      <section>
        <SectionTitle
          icon={Layers}
          title="L'existant, conservé pour comparaison"
          subtitle="Les pages de la génération précédente n'ont pas été touchées : comparez par vous-même (ex. /data-grid vs /grid-next, /virtualization vs /canvas-grid)."
          badge="legacy"
        />
        <div className="mt-5 flex flex-wrap gap-2">
          {LEGACY_PAGES.map((page) => (
            <Link
              key={page.to}
              to={page.to}
              className="group inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              <Badge kind="legacy" />
              <span className="font-medium">{page.label}</span>
              <span className="text-xs text-muted-foreground">— {page.note}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Badge({ kind }: { kind: "new" | "legacy" }) {
  return kind === "new" ? (
    <span className="inline-flex shrink-0 items-center rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-primary uppercase">
      Nouveau
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
      Gen 1
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: "new" | "legacy";
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4.5" />
      </div>
      <div>
        <h2 className="flex items-center gap-2 font-sans text-xl font-bold tracking-tight">
          {title}
          {badge && <Badge kind={badge} />}
        </h2>
        <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
