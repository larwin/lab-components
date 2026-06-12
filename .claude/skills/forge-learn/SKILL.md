---
name: forge-learn
description: >
  Capitaliser une leçon de la session en cours dans les skills Forge et la
  mémoire persistante. À utiliser en fin de chantier, après une correction de
  Nicolas, ou quand un nouveau pattern/piège/préférence a émergé de la
  discussion. C'est le mécanisme qui fait évoluer forge-feature, forge-verify
  et forge-review au fil des sessions.
---

# /forge-learn — faire évoluer les skills Forge

Ce skill transforme l'expérience de la session en savoir réutilisable. Il
s'applique à trois moments : fin d'un chantier, correction ou préférence
exprimée par Nicolas, découverte d'un piège ou d'un pattern.

## 1. Identifier les leçons

Passe la session en revue et extrais ce qui est **non évident et réutilisable** :

- un pattern de conception qui a bien marché (ou un anti-pattern rencontré) ;
- un piège technique (outillage, Windows/PowerShell, jsdom, typage…) ;
- une nouvelle convention adoptée (nommage, structure, API) ;
- une préférence ou correction de Nicolas (façon de piloter, format de
  livraison, politique de commit…) ;
- un nouveau composant/behavior créé qui élargit la carte du moteur.

Ne capitalise PAS : ce que le code ou le RFC documentent déjà, les détails
propres à un seul chantier, les évidences.

## 2. Router chaque leçon vers le bon support

| Nature de la leçon | Destination |
|---|---|
| Comment construire (pattern, convention, étape du pipeline, nouveau behavior/primitive à ajouter à la carte) | `.claude/skills/forge-feature/SKILL.md` — section LEARNINGS, ou le corps du skill si c'est structurel |
| Comment vérifier (commande, piège d'outillage, hygiène de diff) | `.claude/skills/forge-verify/SKILL.md` |
| Quoi surveiller en relecture (violation récurrente, nouveau point de contrôle) | `.claude/skills/forge-review/SKILL.md` |
| Préférence/pilotage de Nicolas, état du projet, faits hors-repo | Mémoire persistante (`~/.claude/projects/...lab-components/memory/`) — mettre à jour la fiche existante plutôt qu'en créer une |
| Décision d'architecture | `docs/RFC-001-NEXT-GEN-ARCHITECTURE.md` (table de statut ou section concernée) |

## 3. Écrire la leçon

Format d'une entrée LEARNINGS :

```
- AAAA-MM-JJ · La leçon en une ou deux phrases, actionnable, avec le
  pourquoi si non évident.
```

Règles :
- **Mettre à jour plutôt qu'empiler** : si une entrée existante couvre le
  sujet, l'enrichir ou la corriger ; supprimer celles devenues fausses.
- Si une section LEARNINGS dépasse ~10 entrées, promouvoir les leçons
  structurelles dans le corps du skill et élaguer.
- Quand la **carte du moteur** change (nouveau dossier core, nouvelle
  primitive, nouvelle route de démo), mettre à jour le bloc « La carte » de
  forge-feature — pas seulement LEARNINGS.
- Une correction explicite de Nicolas prime sur tout contenu existant.

## 4. Clore

- Relire les diffs des skills modifiés (cohérence, pas de doublon).
- Mentionner à Nicolas, en une ou deux lignes, ce qui a été capitalisé et où.
- Les skills étant versionnés dans le repo, inclure leurs modifications dans
  le prochain commit (à sa demande).

## Vocabulaire de pilotage (référence pour toutes les sessions)

- `go` → exécuter la dernière recommandation en autonomie totale, bout en bout.
- `options` → proposer/analyser sans écrire de code.
- `plan` → détailler le plan et attendre validation avant d'agir.
- `quick` → solution pragmatique sans le cérémonial complet (pas de démo/RFC).

## LEARNINGS

- 2026-06-12 · Création des quatre skills Forge. Les principes RFC-001 sont
  intégrés directement dans forge-feature et forge-review pour qu'une session
  vierge soit opérationnelle sans relire le RFC entier.
