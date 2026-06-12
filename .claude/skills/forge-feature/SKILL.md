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
  overlay/    positionnement pur (flip/shift)
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
