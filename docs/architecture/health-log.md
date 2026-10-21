# Journal de santé de l'architecture

Tenu par l'agent `practices-guardian` (`.claude/agents/practices-guardian.md`).
Entrée la plus récente en haut ; les anciennes entrées ne sont jamais réécrites.

## 2026-10-21 — refonte du frontend (mini composants + performances)

| Indicateur | Valeur | Δ |
| --- | --- | --- |
| Fichiers trop gros | 3 (0 dans le frontend) | ↓ 16 |
| Objets style inline | 11 | ↓ 131 |
| bffClient dans l'UI | 0 | ↓ 6 |
| Violations de couche | 0 (contrôle étendu à toutes les couches) | ↓ 1 |
| `any` explicites | 4 (BFF uniquement) | ↓ 6 |
| Ratio de tests frontend | 0.16 | ↓ 0.08 (141 fichiers au lieu de 69 ; 156 tests au lieu de 121) |
| typecheck / tests | ✅ / ✅ | |

Étape de migration atteinte : 0, 1, 3, 4 et 5 (frontend) ; 2 partielle (cf. REARCHITECTURE.md §8)

**Progrès**
- Code mort supprimé (`useMockViews`, `mockViews` ×2, `mockGraphqlData`, ~1 300 lignes).
- `MillerColumn` (798 l.) → `pages/miller/` : `useColumnController` + 8 mini composants ; état des modales dans un réducteur testé.
- `ViewAssistantModal` (584 l.) → `features/view-assistant/` : `model.ts` testé, `useAssistantSession`, 7 composants ; `ChatBubble` et `Reasoning` dans `shared/ui`.
- Accès BFF regroupé dans `entities/view`, `entities/llm`, `entities/preferences`.
- Cycle `views → components` cassé : `ViewRenderer` reçoit `renderWidgetActions`.
- Catalogue de widgets typé exhaustivement (`WIDGET_RENDERERS`), test de couverture des types.
- Performances : pages, modales et graphiques chargés à la demande (bundle initial ≈ 0,8 Mo au lieu de 2,9 Mo ;
  `@ant-design/plots` isolé dans un chunk de 1,46 Mo) ; cartes de widget et colonnes mémoïsées
  (un drag ne re-rend plus les widgets, ouvrir une colonne ne re-rend plus les autres) ; la saisie dans
  l'assistant ne re-rend plus l'aperçu ; modales montées seulement quand elles sont ouvertes.

**À améliorer**
- `views/widgets/charts.tsx` (4 composants) et `views/format.tsx` (2) : à éclater lors du catalogue en plugins (étape 2).
- Étape 2 côté BFF/shared : prompt généré depuis `WIDGET_DEFINITIONS` ; `prompt.ts`, `view-spec.ts` toujours trop gros.
- `views/` n'est pas encore renommé `engine/` ni `catalog/` ; `hooks/useConcepts.ts` et `store.ts` restent à ranger dans `entities/`.
- Tests de `navigation/` : erreurs de typage préexistantes (non vérifiées par `tsc`, qui exclut les tests).
- Étape 0 : ESLint et tests en CI toujours absents.

## 2026-10-21 — audit complet (référence avant migration)

| Indicateur | Valeur | Δ |
| --- | --- | --- |
| Fichiers trop gros | 19 | — |
| Objets style inline | 142 | — |
| bffClient dans l'UI | 6 | — |
| Violations de couche | 1 | — |
| `any` explicites | 10 | — |
| Ratio de tests frontend | 0.24 | — |
| typecheck / tests | non lancés | |

Étape de migration atteinte : aucune (cf. REARCHITECTURE.md §8)

**Dette principale**
- `apps/frontend/src/components/MillerColumn.tsx` — 798 lignes, 12 `useState`, 22 styles inline
- `apps/frontend/src/components/ViewAssistantModal.tsx` — 584 lignes, 36 styles inline
- `apps/frontend/src/views/ViewRenderer.tsx` — importe `components/WidgetEditorModal` (cycle de couches)
- Code mort : `hooks/useMockViews.ts`, `hooks/mockViews.ts`, `views/mockViews.ts`, `graphql/mockGraphqlData.ts`
- CI : pas de tests ni de lint exécutés
