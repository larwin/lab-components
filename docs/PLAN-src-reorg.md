# Plan de réorganisation `src/` — proposition à valider

> **Statut : PROPOSITION. Rien n'est déplacé.** Cible validée avec Nicolas (forks
> tranchés le 14/06/2026). Ce document décrit l'arborescence visée, la table
> from→to, et l'ordre de migration. Exécution **bucket par bucket avec
> `/forge-verify` entre chaque**, sur la branche `chore/src-reorg`, après go explicite.

## Lancer dans une nouvelle session

Prérequis : être sur la branche `chore/src-reorg` (`git fetch && git checkout chore/src-reorg`)
— elle porte le ménage `src/` **et** ce plan. Puis, en ouverture de session, coller :

> Exécute le plan `docs/PLAN-src-reorg.md` : les 9 étapes dans l'ordre, **un commit +
> `/forge-verify` vert par étape**, sur la branche `chore/src-reorg`. Ne touche ni
> `routes/`, ni les entrées SSR (`router.tsx`/`server.ts`/`start.ts`/`routeTree.gen.ts`),
> ni `experimentations/`. Staging par chemins explicites, `.claude/*` hors commit.

Tout le contexte nécessaire est dans ce document (cible, table from→to, ordre,
garde-fous). Le repo a déjà `.gitattributes` (LF) → aucun bruit CRLF au lint. La
méthode de vérif (`bun run format` + `git restore experimentations/`, test, lint,
build, `tsc --noEmit`) est le skill `/forge-verify`.

## Contraintes imposées par l'outillage (NON déplaçables)

- `src/routes/` est le `routesDirectory` par défaut du `@lovable.dev/vite-tanstack-config`.
- Les entrées SSR restent à la racine de `src/` : `routeTree.gen.ts` (généré),
  `router.tsx`, `server.ts`, `start.ts`.

## Arborescence cible

```
src/
  WebApplication.ts          # hôte DI PROD : construit l'arbre App → Account (ex app/campaignTree.ts)
  WebTest.ts                 # hôte DI TEST : même arbre, fakes injectés (ex buildCampaignTree(fakeApi))

  routes/ routeTree.gen.ts router.tsx server.ts start.ts   # entrées TanStack (fixes)

  framework/                 # PURE TECH — frontière de stabilité (INCHANGÉ)
    core/ react/ services/ primitives/ canvas/

  domains/
    business/
      campaign/
        campaigns/ categories/ templates/
      data-management/
        fields/
    technical/
      http/ telemetry/

  features/
    campaign-editor/

  components/                # UI propre de l'app de doc (≠ framework/primitives, la lib)
    Sidebar.tsx Showcase.tsx CodeBlock.tsx PageHeader.tsx MetricCard.tsx …

  playground/
    nav.ts                   # config de navigation des démos
    fixtures/                # jeux de données de démo (ex src/fixtures)

  shared/
    lib/   # cn (utils.ts), config.server, error-*
    utils/ # format, perf
    hooks/ # render-metrics, event-log, mobile
    themes/ # theme-provider, tokens

  test/
    setup.ts
```

## Table from → to

| De                                   | Vers                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| `app/campaignTree.ts`                | `WebApplication.ts` (racine)                          |
| `app/mockApi.ts`                     | `WebTest.ts` (le fake api vit dans l'hôte de test)    |
| `applications/campaign-editor/`      | `features/campaign-editor/`                           |
| `platform/http/`                     | `domains/technical/http/`                             |
| `platform/telemetry/`                | `domains/technical/telemetry/`                        |
| `domains/campaigns/`                 | `domains/business/campaign/campaigns/`                |
| `domains/categories/`                | `domains/business/campaign/categories/`               |
| `domains/templates/`                 | `domains/business/campaign/templates/`                |
| `domains/fields/`                    | `domains/business/data-management/fields/`            |
| `playground/components/*`            | `components/*`                                         |
| `fixtures/`                          | `playground/fixtures/`                                |
| `lib/`                               | `shared/lib/`                                          |
| `utils/`                             | `shared/utils/`                                        |
| `hooks/`                             | `shared/hooks/`                                        |
| `themes/`                            | `shared/themes/`                                       |
| `tests/`                             | `test/`                                                |
| `framework/`, `routes/`, entrées SSR | inchangés                                             |

### Réécritures d'alias `@/` (le gros du travail, mécanique)

`@/app/campaignTree`→`@/WebApplication` · `@/applications/…`→`@/features/…` ·
`@/platform/http|telemetry`→`@/domains/technical/http|telemetry` ·
`@/domains/{campaigns,categories,templates}`→`@/domains/business/campaign/…` ·
`@/domains/fields`→`@/domains/business/data-management/fields` ·
`@/playground/components/…`→`@/components/…` · `@/fixtures`→`@/playground/fixtures` ·
`@/lib/…`→`@/shared/lib/…` · `@/utils/…`→`@/shared/utils/…` ·
`@/hooks/…`→`@/shared/hooks/…` · `@/themes/…`→`@/shared/themes/…` ·
`@/tests/setup`→`@/test/setup`.

## À mettre à jour en plus du déplacement

- **`vitest.config.ts`** : `setupFiles` → `./src/test/setup.ts`.
- **`purity.test.ts`** (test d'architecture) : les motifs de chemins des frontières
  (core/canvas/services sans React ; `framework` n'importe que `framework` ;
  `domains` importe `framework` + barrels de domaines ; `features` n'importe pas une
  autre feature). Les domaines techniques (`http`/`telemetry`) sont importables par
  les domaines métier (ex. `fields` injecte `telemetry`).
- **`eslint.config.js`** : règles `no-restricted-imports` / boundaries si présentes.
- **RFC-003** : §4 (arbre), §7 (règles), §9 (nommage) deviennent obsolètes →
  bandeau « mis à jour par RFC-004 » + **RFC-004** décrivant la structure ci-dessus
  (hôtes WebApplication/WebTest, domaines business/technical, features, shared).
- **READMEs** : un par dossier (re-générer/déplacer) + `src/README.md` (carte) +
  Layer Model de `CLAUDE.md`.

## `WebApplication` / `WebTest` (le point neuf)

- `WebApplication.ts` : exporte la construction de l'arbre de scopes prod
  (App → Account) — l'actuel `buildCampaignTree`, renommé et remonté à la racine.
- `WebTest.ts` : exporte un hôte de test qui bâtit le **même** arbre avec le mock
  api + fakes. Les tests cessent d'appeler `buildCampaignTree(fakeApi)` à la main et
  importent `WebTest` → un seul point d'entrée DI pour les tests, isolé du prod.

## Ordre d'exécution (un commit + `/forge-verify` par étape)

1. `shared/` (lib, utils, hooks, themes) — gros volume (`cn` ~100 fichiers).
2. `tests/` → `test/` (+ `vitest.config`).
3. `fixtures/` → `playground/fixtures/`.
4. `playground/components/` → `components/`.
5. `platform/` → `domains/technical/`.
6. Imbrication des domaines métier (`business/campaign`, `business/data-management`).
7. `applications/` → `features/`.
8. `app/` → `WebApplication.ts` + `WebTest.ts` (racine) ; bascule des tests sur `WebTest`.
9. Docs & garde-fous : `purity.test.ts`, eslint, RFC-003 bandeau + RFC-004, READMEs, `CLAUDE.md`.

## Garde-fous

- Une étape = un commit ; `/forge-verify` (format+test+lint+build+tsc) vert avant la suivante.
- Branche dédiée `chore/src-reorg` (off `chore/src-cleanup`). `routeTree.gen.ts` régénéré par build, jamais édité main. `experimentations/` jamais touché.
- Staging par chemins explicites ; `.claude/*` locaux hors commit.
