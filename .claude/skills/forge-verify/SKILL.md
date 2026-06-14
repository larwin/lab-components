---
name: forge-verify
description: >
  Boucle de vérification complète du repo lab-components (format, tests
  vitest, lint, build, garde de pureté, hygiène du diff). À lancer après toute
  modification de code — par Claude ou manuelle — et systématiquement avant un
  commit.
---

# /forge-verify — la boucle de validation Forge

Exécute ces étapes **dans l'ordre** et rapporte les chiffres réels (jamais
« ça devrait passer »).

## 1. Format

```
bun run format
```

⚠️ Prettier reformate aussi `experimentations/` (conversions LF→CRLF sans
valeur). Immédiatement après :

```
git restore experimentations/
```

`experimentations/` est le bac à sable gen-2 (source d'inspiration, lint-ignored) :
il ne doit **jamais** apparaître dans un diff.

## 2. Tests

```
bun run test
```

- **Jamais `bun test`** : c'est le runner natif de Bun, il ramasse
  `experimentations/` et n'a pas le setup jsdom → faux échecs massifs.
- Vérifier que `purity.test.ts` est dans les fichiers passés : c'est la garde
  d'architecture (zéro import React dans `core/` et `canvas/`, ni dans
  `gridMachine.ts`). S'il échoue, c'est le code qui a tort, pas le test.
- Un seul fichier : **`bun run test <chemin>`** — PAS `bun vitest run <chemin>`
  en direct, qui casse la collection (`Vitest failed to find the current suite`)
  sur un fichier `// @vitest-environment node` à cause du setup jsdom global ;
  le script configuré (`vitest run`) gère le cas, le binaire nu non.

## 3. Lint

```
bun run lint
```

Attendu : **0 erreur**. Les ~10 warnings `react-refresh/only-export-components`
sont préexistants et acceptés — ne pas les « corriger » en éclatant des
fichiers, ne pas en ajouter de nouveaux types.

## 4. Typecheck + build

```
bun run build
bunx tsc --noEmit
```

Dans cet ordre si une route a été ajoutée/renommée : le build régénère
`routeTree.gen.ts`. `routeTree.gen.ts` ne s'édite jamais à la main.

⚠️ **`bun run build` (vite/esbuild) ne typecheck PAS** — il strippe les types.
`bunx tsc --noEmit` est donc le **seul** vrai gate de typage, obligatoire avant
commit (un build vert ne garantit rien côté types).

## 5. Hygiène du diff (avant commit)

- `git status --short` : aucun fichier `experimentations/` modifié.
- La table de statut de `docs/RFC-001-NEXT-GEN-ARCHITECTURE.md` reflète le
  chantier (🔜 → ✅ avec lien démo).
- Si une nouvelle route existe : entrée dans `src/playground/nav.ts` et,
  pour un chantier majeur, carte sur la home (`src/routes/index.tsx`).
- Commit : seulement à la demande de Nicolas ; message conventionnel
  (`feat(framework): …`) avec un corps qui liste ce qui est vérifiable.
- **Staging sélectif, jamais `git add -A`/`.`** : des untracked locaux à Nicolas
  (`.claude/commands/`, `.claude/settings.json`) ne doivent pas partir dans le
  commit. Stager par chemins explicites (`git add src/ docs/ CLAUDE.md …`) et
  relire `git status --short` pour confirmer ce qui est `A/M/D` vs ce qui reste
  `??`.
- **Check-up pré-commit d'un gros chantier** (à la demande de Nicolas) : retirer
  les dossiers d'essai (un exemple jeté, du scratch non suivi par git) ; scanner
  docs + sources pour les références périmées. Un RFC antérieur rendu obsolète se
  traite par un **bandeau « mis à jour par RFC-XXX »** en tête (renommages +
  déménagements) en conservant le corps comme trace historique — pas une
  réécriture. Branche dédiée + merge ff dans `main` quand il le demande.

## Rapport attendu

Une ligne par étape avec les chiffres : `X tests verts · lint 0 erreur ·
build OK · diff propre`. En cas d'échec : la cause racine et le correctif,
pas un contournement.

## LEARNINGS (enrichi au fil des sessions — voir /forge-learn)

- 2026-06-12 · PowerShell 5.1 : ne jamais réécrire un fichier texte via
  `Get-Content`/`Set-Content` (corruption UTF-8) — outils Write/Edit
  uniquement. Confirmé en vague 4 : même un « petit » remplacement regex en
  batch (`-replace` sur tous les call sites) mojibake les tirets/accents ;
  pour N occurrences identiques, Edit `replace_all` ou réécriture Write.
  `git push` écrit sa confirmation sur stderr : le `NativeCommandError`
  PowerShell est cosmétique si `main -> main` apparaît.
- 2026-06-12 · Formatage ciblé : `bunx prettier --write <fichiers du chantier>`
  évite le passage global de `bun run format` sur `experimentations/` (et donc
  le `git restore` obligatoire). Le lint vérifie prettier de toute façon.
- 2026-06-12 · Caractères Unicode invisibles (U+202F…) littéraux dans le code
  ⇒ erreur lint `no-irregular-whitespace` : toujours des échappements
  `\uXXXX` dans les regex. Piège de réparation : l'outil Edit ne matche pas
  les invisibles de façon fiable et la génération retombe en littéraux ; la
  voie sûre est PowerShell `[IO.File]` en construisant la chaîne par morceaux
  (`[char]0x5C + 'u00a0'`), écrite via `WriteAllText` + `UTF8Encoding($false)`
  — jamais `WriteAllLines`, qui force du CRLF (vague de `Delete ␍` prettier).
- 2026-06-12 · Messages de commit multi-lignes : le here-string PowerShell
  `git commit -m @'…'@` peut se déquoter silencieusement (le commit reçoit
  des morceaux du message comme pathspecs et échoue à moitié). Voie robuste :
  écrire le message via l'outil Write dans `.git/COMMIT_MSG.txt`, puis
  `git commit -F .git/COMMIT_MSG.txt` et supprimer le fichier.
- 2026-06-12 · Ne jamais chaîner `prettier --write` et `bun run test` dans la
  même commande composée : vitest peut lire des fichiers en cours de
  réécriture (échec fantôme). Deux commandes séparées.
- 2026-06-14 · Fichier isolé : `bun run test <chemin>`, jamais `bun vitest run`
  en direct (casse sur le setup jsdom pour un fichier node-env) — §2 corrigée.
  Et `bun run build` ne typecheck pas : `bunx tsc --noEmit` est le seul gate de
  typage (§4). Sur un gros chantier : staging par chemins explicites (les
  untracked `.claude/*` locaux restent dehors) et bandeau « superseded » sur un
  RFC obsolète plutôt qu'une réécriture (§5).
- 2026-06-14 · **CRLF résolu à la racine.** Lint qui crache des milliers de
  `prettier/prettier Delete ␍` = fins de ligne CRLF, pas un vrai souci de code :
  cause = `core.autocrlf=true` sans `.gitattributes` (les blobs LF sont *checkout*
  en CRLF sous Windows). **Fix posé le 14/06 : `.gitattributes` (`* text=auto
  eol=lf`) commité** → tout checkout futur arrive en LF, lint vert. Si ça
  réapparaît : `bun run format` (LF) + `git restore experimentations/`, vérifier
  que `.gitattributes` existe. Prouver qu'un diff est purement EOL :
  `git diff --ignore-cr-at-eol <fichiers>` (vide = contenu identique). L'outil
  Edit fonctionne très bien sur un fichier CRLF (pas besoin de tout réécrire).
