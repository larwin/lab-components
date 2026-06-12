---
name: forge-feature
description: >
  Construire une nouvelle fonctionnalité, un nouveau behavior, une nouvelle
  primitive ou une modification du moteur Forge next-gen en suivant la méthode
  RFC-001 (machine pure → tests Node → adaptateur → démo → verify). À utiliser
  dès qu'on ajoute ou modifie du code dans src/framework/** ou une page de
  démo associée.
---

# /forge-feature — construire sur le moteur Forge

Tu agis comme l'architecte principal du moteur Forge. Cette recette a produit
les chantiers overlays, data async, édition de grille, colonnes, groupement,
Kanban et canvas **sans retour correctif**. Suis-la dans l'ordre.

## Les principes non négociables (RFC-001 §3)

1. **Le core n'importe rien.** `src/framework/core` (et `src/framework/canvas`)
   n'importent jamais React ni le DOM — seulement des miroirs structurels
   (`KeyStroke`) et `Intl`. C'est gardé par `src/framework/core/purity.test.ts` :
   si ton code le casse, c'est ton code qui a tort.
2. **L'état ne change que par intents.** Toute mutation est un intent dispatché,
   journalisé, rejouable, portant sa `source` (keyboard/pointer/shortcut/program).
3. **Les effets décrivent, les adaptateurs exécutent.** Un reducer retourne
   `FocusElement`, `ScrollToItem`, `Announce`, `RestoreFocus`… — il n'appelle
   jamais rien. Même les callbacks utilisateur (`onPress`, `onSelectionChange`)
   sont des effets `event/emit` interprétés en bordure.
4. **Composition plutôt qu'héritage.** Un composant = une composition de
   behaviors (`composeMachine`). Nouveau composant ⇒ nouvelle composition
   d'abord, nouveau code en dernier recours.
5. **La virtualisation est première classe.** Focus logique
   (`aria-activedescendant`), jamais de roving tabindex sur des collections
   virtualisables : l'item focalisé peut ne pas être monté.
6. **A11y et i18n sont des sorties du core.** L'ARIA dérive de l'état, les
   annonces lecteur d'écran sont des effets, tri/typeahead passent par
   `Intl.Collator`.

## La carte

```
src/framework/core/        LE PRODUIT — pur, testé en Node
  runtime/    intents, effets, machines, store journalisé + bus inspecteur
  behaviors/  composeMachine + Focusable/Pressable/Toggleable/Navigable/
              Selectable/Expandable/Dismissable/Searchable/Actionable/
              Validatable (dirty/touched/error + annonces)/NumericValue
              (clamp/step, profils keymap spinbutton|slider)
  collection/ modèle normalisé, navigation, algèbre de sélection, typeahead
  i18n/       translator, collators, formatNumber/parseNumber (round-trip Intl)
  interaction/ combos clavier, résolution de keymap, scopes de raccourcis
  virtualization/ fenêtrage Fenwick O(log n)
  data/       query (tri/filtre), grouping, loader machine (async sans courses)
  dnd/        drag machine (pointeur + clavier + annonces)
  overlay/    positionnement pur (flip/shift) + toast queue machine
  text/       characterLimit (politique compteur) + machine PinInput
  date/       DateValue pur + arithmétique civile, services Intl
              (firstDayOfWeek/libellés/formatToParts/DisplayNames),
              machines calendarGrid (single + range) et dateField
  field/      machine de segments générique (curseur, auto-avance,
              brouillon/commit, projection getValue/isEqual injectée) —
              dateField et timeField en sont deux configurations
  time/       TimeValue pur (stockage 0-23, wrap à minuit, secondes opt-in),
              conversions de cycle h11/h12/h23/h24, services Intl
              (hourCycleOf/timeFieldParts/dayPeriodLabels), DateTimeValue
src/framework/react/       L'ADAPTATEUR — useMachine, interpréteurs d'effets,
                            Overlay (pile de layers), useVirtualizer, useDataSource
src/framework/primitives/  Les composants composés (coquilles minces)
src/framework/canvas/      Le 2ᵉ renderer — mêmes machines, zéro React
src/routes/                Les démos ; nav dans src/playground/nav.ts
docs/RFC-001-NEXT-GEN-ARCHITECTURE.md  La référence + table de statut
```

## Le pipeline, dans l'ordre

### 1. Logique → machine pure dans le core

- Intents namespacés `domaine/action` (`select/select`, `grid/edit-commit`),
  créés via `defineIntent<Payload>()`. Effets via `defineEffect<Payload>()`.
- Comportement transverse réutilisable ⇒ `defineBehavior` (slice namespacée,
  handlers purs, keymap déclarative, aria dérivé). Comportement spécifique à
  un composant complexe ⇒ machine dédiée via `createMachine` (cf. gridMachine,
  dragMachine, loader).
- Géométrie/données injectées par **getters de config** (`getCollection()`,
  `rowCount()`) — jamais de données figées dans la machine.
- Coordination entre behaviors : pipeline fan-out (plusieurs behaviors gèrent
  le même intent, dans l'ordre de composition) ; `ctx.read()` voit les slices
  déjà mises à jour dans ce dispatch, `ctx.readInitial()` l'état pré-dispatch
  (indispensable quand un behavior réagit au focus que Navigable vient de
  déplacer).
- Le temps est injecté (timestamps dans les payloads), jamais lu dans le core.
- Keymaps : syntaxe `"Mod+Shift+K"`, `"Space"` (jamais `" "`), `"@printable"`
  pour le typeahead ; un binding peut retourner `null` pour laisser passer.

### 2. Tests Node purs AVANT l'adaptateur

- Fichier co-localisé, en-tête `// @vitest-environment node`.
- On teste des machines complètes en dispatchant des intents et en inspectant
  état + effets — y compris ce qu'on croit intestable sans DOM : courses
  async (séquences), drag & drop, annonces SR.
- Helper type : `press(stroke)` = `resolveBinding(composed.keymap(state), stroke)`
  puis dispatch — teste la keymap déclarative elle-même.

### 3. Adaptateur / primitive React (coquille mince)

- `useComposedMachine` / `useMachine` ; la config lit les props via
  `useLiveRef` (getters) — la machine ne se reconstruit jamais.
- Effets interprétés par `useForgeEffects` ; surcharger un interpréteur par
  type d'effet quand il faut (ex. `scrollToItem` → virtualizer).
- Items mémoïsés : ref callbacks et handlers stables (registry par clé,
  handlers créés une fois dans `useState(() => …)`).
- Données contrôlées : la primitive ne mute jamais `data`, elle remonte des
  événements (`onCellEdit`, `onMove`…).

### 4. Démo vérifiable

- Route `src/routes/<nom>.tsx` (groupe « Next-Gen Engine » dans
  `src/playground/nav.ts`) avec PageHeader expliquant QUOI tester, MetricCards
  chiffrées, et instructions d'interaction concrètes.
- Ajouter la carte correspondante sur la home (`src/routes/index.tsx`,
  tableau `NEXT_GEN_DEMOS`) si c'est un chantier majeur.

### 5. Documentation + vérification

- Mettre à jour la **table de statut du RFC-001** (la ligne 🔜 devient ✅ avec
  le détail et le lien démo).
- Lancer `/forge-verify` (ou la boucle manuelle décrite dedans).
- Conclure en proposant le chantier suivant en une ligne.

## Pièges connus du repo

- `bun test` = runner natif Bun (ramasse `experimentations/`, casse) →
  **toujours `bun run test`** (vitest).
- `bun run format` reformate `experimentations/` (LF→CRLF massif) →
  **`git restore experimentations/` avant tout commit**. Ce dossier est un
  bac à sable d'inspiration (gen 2) : ne jamais le modifier.
- Nouvelle route ⇒ `bun run build` régénère `routeTree.gen.ts` **avant**
  `bunx tsc --noEmit`, sinon le typecheck échoue sur le chemin.
- Ne jamais réécrire un fichier UTF-8 via PowerShell (`Set-Content`) :
  corruption d'encodage. Utiliser les outils Write/Edit.
- jsdom n'implémente pas `scrollIntoView` → appels optionnels
  (`el?.scrollIntoView?.(…)`) dans les interpréteurs.

## Definition of done

- [ ] Logique dans le core, zéro logique métier dans le composant React
- [ ] Tests Node verts sur la machine (intents → état + effets)
- [ ] `bun run test` / `lint` / `build` verts (purity.test.ts compris)
- [ ] Démo + nav + table RFC à jour
- [ ] Proposition du chantier suivant

## LEARNINGS (enrichi au fil des sessions — voir /forge-learn)

- 2026-06-12 · Espace ne va au typeahead que si une recherche est active
  (`stroke.at` vs `lastTypedAt`), sinon il retombe sur sélection/press — régler
  les conflits de touches par des bindings qui retournent `null`, pas par des
  if dans les composants.
- 2026-06-12 · `Behavior<string, any, any>` (et non `unknown`) pour
  `AnyBehavior` : strictFunctionTypes rend les slices contravariantes dans les
  handlers.
- 2026-06-12 · Indices visuels partout dans la grille : curseur, tri, édition
  et clipboard passent par l'ordre **effectif** des colonnes (live ref), pas
  l'ordre des props.
- 2026-06-12 · Contrôlé/non-contrôlé : la machine reste la source de vérité ;
  un `useEffect` re-synchronise quand la prop contrôlée diverge (intent source
  "program"). Les events ne s'émettent que sur vrai changement, donc pas d'écho.
- 2026-06-12 · Un behavior paramétrable par config vaut mieux que deux
  behaviors jumeaux : `numericValue` sert NumberField ET Slider via un profil
  keymap (`keys: "spinbutton" | "slider"`), `toggleable` sert Checkbox/Switch
  ET Toggle via `ariaAttribute: "checked" | "pressed"`, `navigable` sert les
  groupes horizontaux via `orientation`. C'est ce qui rend tenable la règle
  « un nouveau behavior doit servir ≥ 2 composants ».
- 2026-06-12 · `Button type="submit"` : le DOM reste `type="button"` et la
  soumission passe par l'événement `press` → `form.requestSubmit()` — sinon la
  keymap (preventDefault sur Enter/Space) avale la soumission native et
  clavier/pointeur divergent.
- 2026-06-12 · Champs validables : `validate` au blur (intent `validity/touch`),
  puis re-validation live seulement une fois `touched` — et un miroir ref
  synchrone de la valeur pour que le validate du même tick lise la frappe en
  cours (les live refs ne se mettent à jour qu'au re-render).
- 2026-06-12 · Quand les items sont de vrais boutons en tab order (Accordion),
  garder la machine Navigable et réinterpréter son effet `scrollToItem` en
  « focus ce bouton » (override d'interpréteur + registry) : wrap, Home/End,
  skip des items désactivés et typeahead restent dans le core.
- 2026-06-12 · Les exports non-composants partagés entre primitives (tableaux
  de behaviors, constructeurs de collection) vont dans un module `.ts` voisin
  (cf. `menu-core.ts`) — pas dans le `.tsx`, sinon nouveau warning
  react-refresh. Overlay au pointeur (ContextMenu) : ancre virtuelle 0×0
  positionnée aux coordonnées du clic, le positioning core fait le reste.
- 2026-06-12 · Timers sans horloge dans le core (Toast) : le reducer émet des
  paires d'effets `schedule-…`/`cancel-…` et l'adaptateur tient une
  `Map<id, handle>` de setTimeout ; chaque chemin qui retire un item (dismiss,
  éviction au-delà du plafond, clear) doit émettre son `cancel-…`, sinon fuite
  de timer. Tout le cycle se teste en Node sans fake timers.
- 2026-06-12 · Nœud sentinelle (TagsInput) : pour relier un élément hors
  collection (le champ texte) à une rangée Navigable, l'inclure comme nœud
  sentinelle de la collection — « Backspace sur champ vide → dernier chip »
  devient `nav/previous` et « sortir des chips → input » devient `nav/next`,
  zéro logique dans la coquille. Deux machines peuvent coopérer dans une
  primitive si la passerelle clavier est une fonction pure testée en Node
  (cf. tags-core), et le `scrollToItem` de la rangée se réinterprète en focus
  DOM (pattern Accordion).
- 2026-06-12 · Effets dépendants de la source : un intent `program`
  (re-synchronisation contrôlée) ne doit jamais émettre d'effet de focus DOM —
  filtrer sur `intent.source` dans le reducer (cf. machine PIN). Généralise la
  règle contrôlé/non-contrôlé : la synchronisation est silencieuse côté DOM
  comme côté events.
- 2026-06-12 · Un behavior peut porter une keymap opt-in par config
  (Searchable : `clearOnEscape`/`submitOnEnter`) — le binding Escape retourne
  `null` quand la requête est vide pour laisser la touche aux overlays
  parents ; les composeurs existants (ComboBox) ne passent pas les flags et ne
  voient aucun binding nouveau.
- 2026-06-12 · Menubar : « le panneau ouvert EST le focusedKey de la barre » —
  composer Navigable(horizontal)+Dismissable sur la barre rend « ← → traverse
  les menus ouverts » et « le survol bascule » triviaux (nav/next, nav/move) ;
  le panneau est UNE machine Menu dont `getCollection` lit le menu actif.
  Ancre mobile pour l'Overlay : objet ref stable avec un getter `current` qui
  lit le registry (`triggerRegistry.get(activeKey)`), jamais un objet recréé
  par render.
- 2026-06-12 · « Réutilise la machine X » se vérifie contre l'abstraction, pas
  le nom : la dragMachine modélise des items entre zones — pour un ratio
  continu (Splitter), c'est NumericValue qui est la bonne réutilisation
  (4ᵉ : NumberField, Slider, Rating, Splitter). Justifier la substitution
  dans la table RFC.
- 2026-06-12 · Domaine à état riche (dates) : l'état machine ne porte que des
  valeurs pures sérialisables (`DateValue {year,month,day}`) ; `Date` ne sert
  que de véhicule éphémère vers `Intl.DateTimeFormat` (toujours UTC, via
  `setUTCFullYear` pour les années < 100) dans le module intl du core — même
  pattern que formatNumber/parseNumber. Les libellés localisés entrent dans la
  machine par getters de config (`monthLabel`, `dateLabel`), jamais par appel
  Intl direct dans le reducer.
- 2026-06-12 · Effets de focus par source, raffinement calendrier :
  `focusElement` seulement pour `keyboard`/`shortcut` — un clic pointeur sur
  un bouton de navigation (mois suivant) ne doit pas voler le focus vers la
  grille, et la cellule cliquée prend déjà le focus DOM nativement. Les
  annonces SR, elles, partent pour toute source non-`program`.
- 2026-06-12 · Quand un effet de focus cible un élément monté par le même
  dispatch (changement de mois ⇒ nouvelle grille), surcharger l'interpréteur
  `focusElement` avec un report d'une frame (`requestAnimationFrame`) : React
  a commité au moment où le rAF s'exécute. Pattern jumeau de l'override
  `scrollToItem` → focus DOM (Accordion).
- 2026-06-12 · Saisie segmentée (DateField) : un segment en cours de frappe
  est un brouillon — il compte comme vide pour l'émission d'événements, et
  `change` ne part qu'aux points de commit (buffer `typed` redevenu vide :
  auto-avance, flèche, segment plein). Sinon taper « 2026 » égrène
  2 → 20 → 202. Un intent `commit` dédié permet à l'adaptateur de vider le
  brouillon au blur du groupe.
- 2026-06-12 · Binding dépendant de l'état dans une machine dédiée (pas un
  behavior) : passer un `getState` optionnel à la fabrique de keymap
  (`calendarKeymap(config, getState)`) — Escape n'annule l'ancre du mode
  range que si elle existe, sinon le binding retourne null et l'overlay
  parent garde la touche. Les behaviors ont leur slice dans `keymap(slice)`,
  les machines dédiées doivent l'injecter.
- 2026-06-12 · Preview d'intervalle : pas d'état `hover` dans la machine —
  le survol dispatch `focus-date` (source pointer) et la preview est une
  dérivation pure `calendarRange(state)` = ancre → focus ordonnés. Clavier
  et pointeur convergent gratuitement, et le commit est ordonné par
  construction (jamais de validation début ≤ fin a posteriori dans la grille).
- 2026-06-12 · Généraliser une machine quand le 2ᵉ consommateur arrive (dateField
  → core/field/segments pour timeField) : la détection de changement passe par
  une projection injectée (`getValue` + `isEqual`), jamais par comparaison des
  valeurs brutes — deux brouillons différents peuvent se projeter sur la même
  valeur clampée (31/02 ≡ 28/02) et dripperaient des doublons. Les segments
  non numériques (AM/PM) entrent par `parseChar` ; le binding `@printable` ne
  capture les lettres que si un segment textuel existe, sinon il retourne
  null (pas de preventDefault global).
- 2026-06-12 · Domaine à convention d'affichage (heures 12/24 h) : l'état de la
  machine stocke ce qui est AFFICHÉ par segment (heure 1-12 + dayPeriod), la
  valeur composée stocke la forme canonique (0-23) — la conversion est une
  paire de fonctions pures (displayHour/hourFromDisplay) testée en round-trip
  sur tout le domaine (24 h × 4 cycles). Le cycle vient de
  `resolvedOptions().hourCycle`, jamais deviné. Propriété optionnelle
  sémantique (`second?`) : l'arithmétique préserve sa présence/absence,
  l'égalité la neutralise (second 0 ≡ absent).
- 2026-06-12 · Composer deux champs en un (DateTimeField) : deux instances de
  la même machine dans un seul groupe ARIA, chaque moitié garde sa saisie
  partielle, et la coquille n'émet la composition que sur vraie transition
  (ref du dernier émis) — sinon écho de null pendant le remplissage de la
  seconde moitié.
- 2026-06-12 · « Une machine, N rendus » (TimePicker segments/colonnes/roue/
  cadran) : quand le contrat de props et le comportement sont identiques et
  que seule la projection change, c'est UN composant avec un prop `variant`,
  pas N primitives — et la démo doit brancher toutes les variantes sur le
  MÊME état contrôlé (c'est la preuve). Les décisions visuelles (quelles
  options, où retombe un offset, quel angle → quelle valeur) sont des
  fonctions pures du core testées en Node ; le snap circulaire se calcule en
  vraie distance angulaire (min(diff, 360−diff)), jamais en arrondi — exact
  même quand le pas ne divise pas 60.
- 2026-06-12 · Les handlers d'événements passés à useForgeEffects sont
  capturés UNE fois : tout ce qu'ils lisent (commit, config, valeur courante)
  passe par live.current — un `commit` recréé à chaque render et capturé par
  l'interpréteur commit sur un état périmé. Les handlers JSX (closures
  fraîches par render) n'ont pas ce problème.
- 2026-06-12 · Statiques sans machine (Alert, Badge, Avatar, Card, Skeleton,
  Spinner, EmptyState…) : rôle ARIA correct + tokens + variantes CVA, point.
  Quand un statique a quand même UNE décision (compteur TextArea, acceptation
  Dropzone), l'extraire en fonction pure testée en Node (`characterLimit`,
  `partitionFiles`) et annoncer via `announceNow` — le pattern « politique
  pure + annonce en bordure ». Dropzone : l'input file natif masqué reste LE
  contrôle focusable (jamais d'input imbriqué dans un button — HTML invalide).
