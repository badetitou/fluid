# Journal de santé de l'architecture

Tenu par l'agent `practices-guardian` (`.claude/agents/practices-guardian.md`).
Entrée la plus récente en haut ; les anciennes entrées ne sont jamais réécrites.

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
