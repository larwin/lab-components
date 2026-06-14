# Chantier — Clarifier l'architecture des répertoires `src/` + README par dossier

> **Comment utiliser ce fichier :** colle son contenu comme prompt d'ouverture
> d'une **nouvelle session** Claude Code à la racine de `lab-components`. Il est
> autosuffisant (une session vierge n'a pas le contexte de la session qui l'a
> écrit le 14/06/2026).

---

## Objectif

L'arborescence `src/` a accumulé plusieurs générations (gen-1, gen-1.5,
next-gen RFC-001/002/003, plus une lib shadcn temporaire). On ne voit plus
clairement, par dossier : **à quoi il sert, ce qui est actif vs hérité/mort, et
ce qui appartient à quelle couche.** Concrètement, il y a des composants dans
`src/framework/components` ET dans `src/components/ui` — ce dernier est suspecté
d'être un héritage de la v1.

Le chantier a **trois livrables** :

1. **Un audit précis** de chaque répertoire de `src/` (rôle, contenu, lignée,
   statut, dépendances).
2. **Un `README.md` par répertoire significatif**, en anglais (convention repo :
   docs techniques en anglais), court et factuel.
3. **Un plan de ménage** (fusion / dépréciation / suppression / déplacement) —
   **à faire valider AVANT toute suppression ou déplacement de code.**

> Le but premier est la **clarté** (comprendre + documenter). Le ménage
> destructif (supprimer/déplacer) ne se fait qu'après validation explicite de
> Nicolas, étape par étape.

---

## Inventaire de départ (à vérifier, ne pas prendre pour argent comptant)

Relevé le 14/06/2026 — `find src -maxdepth 2 -type d` :

```
src/
  framework/            PUBLIC API, la frontière de stabilité (206 fichiers)
    core/               next-gen pur : Intent→Reducer→State→Effects (RFC-001). Zéro React/DOM.
    react/              adaptateur React du core (useMachine, …) + react/services
    services/           conteneur DI + invalidation (RFC-002/003). Zéro React.
    primitives/         composants next-gen composés depuis le core
    components/         composants GEN-1 (hérités) — possible recouvrement avec primitives/
    collections/        GEN-1.5 (a un README qui dit « superseded by core/collection »)
    engines/            GEN-1.5 (« superseded by core/ »)
    canvas/             adaptateur de rendu #2 (gardé pur par purity.test.ts)
  domains/              métier RFC-003 (categories, templates, fields, campaigns)
  applications/         features UI RFC-003 (campaign-editor)
  platform/             infra transverse en value tokens (http, telemetry)
  app/                  racine de composition (scope tree)
  components/ui/        lib shadcn TEMPORAIRE (≈46 fichiers) — SUSPECT legacy v1
  routes/               pages TanStack (playground / doc vivante) + README
  playground/           helpers de démo (playground/components)
  fixtures/             jeux de données de démo
  hooks/                hooks utilitaires (useRenderMetrics, useEventLog)
  lib/                  lib/api + (cn()/utils ?) — À CLARIFIER
  utils/                format.ts, perf.ts
  themes/               tokens CSS + ThemeProvider
  tests/                setup.ts (jest-dom + cleanup)
```

READMEs déjà présents (à mettre au même format) : `framework/collections/README.md`,
`framework/components/DataGrid/README.md`, `routes/README.md`.

Sources d'autorité à lire d'abord : `CLAUDE.md` (Layer Model + règles), et les
RFC `docs/RFC-001` (core), `docs/RFC-002` (services, avec bandeau), `docs/RFC-003`
(domains/applications/scopes composites).

---

## Zones suspectes à investiguer en priorité

1. **`src/components/ui`** — lib shadcn « temporaire ». Qui l'importe encore ?
   (CLAUDE.md interdit d'y bâtir du neuf.) Candidat fort à la dépréciation /
   isolation, voire suppression si plus rien d'actif ne l'utilise hors d'elle-même.
2. **`src/framework/components` (gen-1) vs `src/framework/primitives` (next-gen)**
   — recouvrement ? Quels composants gen-1 sont encore utilisés par des routes ?
   Lesquels sont remplacés par une primitive équivalente ?
3. **`src/framework/collections` + `src/framework/engines` (gen-1.5)** — leurs
   propres READMEs disent « superseded by core ». Encore importés ? Par quoi ?
   Reste-t-il une raison de les garder, ou faut-il planifier leur retrait ?
4. **`src/lib`** — `lib/api` sert à quoi ? Doublon avec `platform/http` (ApiClient) ?
   `cn()` / utils : où vit l'utilitaire de classes ? (`@/lib/utils` est référencé.)
5. **Code mort général** — modules exportés que plus personne n'importe.

---

## Méthode attendue

1. **Lire** CLAUDE.md + les 3 RFC + les READMEs existants pour la lignée des couches.
2. **Cartographier** chaque dossier : lister les fichiers, lire les barrels
   (`index.ts`) et quelques fichiers clés, comprendre le rôle.
3. **Détecter l'usage réel** par grep d'imports : pour un dossier/ module suspect,
   `Grep "@/framework/components\b"`, `@/components/ui`, `@/framework/collections`,
   `@/framework/engines`, `@/lib`, etc. — qui l'importe, depuis quelle couche ?
   Un module sans import entrant (hors lui-même et ses tests) est candidat « mort ».
   Distinguer : importé par des **routes/démos** (vivant), par d'autres modules
   **gen-1** seulement (legacy en vase clos), ou **plus du tout** (mort).
4. **Classer** chaque dossier : `actif` / `legacy-encore-utilisé` / `déprécié`
   (superseded, à retirer plus tard) / `mort` (supprimable) / `support`.
5. **Écrire les README** (template ci-dessous).
6. **Écrire la synthèse** : un `src/README.md` racine = carte des couches + tableau
   par dossier (rôle, statut, RFC de référence). Mettre à jour le « Layer Model »
   de `CLAUDE.md` si la réalité diverge.
7. **Proposer le plan de ménage** : pour chaque dossier `déprécié`/`mort`, l'action
   recommandée (garder + documenter / déprécier avec note / supprimer / fusionner /
   déplacer), avec l'impact (qui casse). **Ne rien supprimer ni déplacer sans go.**

---

## Template de `README.md` (par dossier, en anglais)

```md
# <chemin du dossier>

**Role:** one sentence — what this directory is for.
**Layer / generation:** next-gen (RFC-00x) | gen-1 | gen-1.5 | support | legacy.
**Status:** active | legacy (still used by …) | deprecated (superseded by …) | scheduled for removal.

## What lives here

- bullet list of the main files/subfolders and their job.

## Conventions / rules

- what belongs here, what does NOT, naming, purity constraints (e.g. "no React").

## Used by / depends on

- inbound: who imports from here.
- outbound: what this depends on.

## See also

- links to the authoritative RFC / related dirs.
```

Garder court et vrai. Pour un dossier déprécié, dire clairement **par quoi il est
remplacé** et **s'il reste des usages**.

---

## Garde-fous (non négociables)

- **Phase clarté d'abord, ménage ensuite.** Cette session **documente et propose** ;
  toute suppression/déplacement/fusion de code attend un **go explicite** de Nicolas,
  livré comme un **plan à relire** (il pilote les gros changements structurels par
  plan-puis-validation).
- **Règle composants (CLAUDE.md)** : ne pas bâtir de neuf sur `components/ui` ;
  ne pas introduire de lib externe ; l'UI se compose de `@/framework/primitives`.
- **Ne jamais toucher** `routeTree.gen.ts` (généré) ni `experimentations/` (sandbox).
- **Vérifier après chaque étape** via `/forge-verify` : `bun run format` (+
  `git restore experimentations/`), `bun run test`, `bun run lint`,
  `bun run build`, **`bunx tsc --noEmit`** (le build vite ne typecheck pas).
  Fichier de test isolé : `bun run test <chemin>` (jamais `bun vitest run`).
- **Commit** seulement sur demande, **staging par chemins explicites** (laisser
  dehors les untracked locaux `.claude/commands/`, `.claude/settings.json`),
  branche dédiée.

---

## Critères d'acceptation

- [ ] Chaque répertoire significatif de `src/` a un `README.md` court, exact, au
      format ci-dessus (les 3 READMEs existants alignés au même format).
- [ ] Un `src/README.md` racine sert de carte (couches + tableau de statut par dossier).
- [ ] Le « Layer Model » de `CLAUDE.md` est cohérent avec la réalité.
- [ ] Chaque dossier est classé (actif / legacy / déprécié / mort / support) avec
      preuve d'usage (qui l'importe), pas une supposition.
- [ ] Un plan de ménage écrit (actions + impact) est proposé pour validation —
      **aucune suppression/déplacement effectué sans go.**
- [ ] `/forge-verify` vert (rien cassé par l'ajout de docs).

---

## Pilotage

Échange en **français**, READMEs et docs en **anglais**. Preuves vérifiables
(grep d'imports, pas d'affirmation « c'est sûrement mort »). Pour la phase
destructive : un plan détaillé à relire avant exécution. Lancer `/forge-learn`
en fin de chantier.
