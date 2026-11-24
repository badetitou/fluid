# Explorateur de graphe (`graphExplorer`)

Un widget de graphe hiérarchique dont les nœuds s'ouvrent **dans le graphe** : un nœud ouvert devient une boîte
contenant de vrais widgets fluid. L'état d'interaction est session-only ; la vue ne stocke que des valeurs initiales.

## Contrat partagé (`packages/shared`)

- `widgets/graphExplorer.ts` : champs, doc LLM (`graphExplorerWidgetDoc`), exemple curé (`graphExplorerExample`),
  `normalizeGraphExplorerIntent(intent)`.
- `widgets/graphExplorerPresets.ts` : constantes réservées et quatre presets. L'LLM écrit une **intention courte**
  (`preset` + quelques noms de champs) ; le normaliseur pur applique les valeurs du preset, puis les champs explicites.
- `view-spec.ts` : `graphExplorerDraftSchema`, `graphExplorerIntentSchema`, champ récursif `widgets` et `queries[].lazy`.
- `plugins/contracts.ts` : contrat exhaustif, donc la doc LLM est générée par `renderWidgetDocs` (aucun prompt écrit à la main).

| Preset | Usage |
| --- | --- |
| `code-dependencies` | Paquets/classes et leurs dépendances, Vue en réseau, layout en couches descendantes. |
| `inheritance` | Superclasses, vue d'arbre, groupes par paquet repliés. |
| `calls` | Appelants/appelés, layout de gauche à droite. |
| `generic` | N'importe quelle liste d'éléments liés, layout de force. |

### Bindings réservés

- `$node` : la ligne du nœud ouvert, lue par les widgets imbriqués (`data: { query: "$node", path?: "..." }`).
- `$detail` : le résultat de la requête nommée par `detailQuery`, après sélection de `detailPath`.
- `detailQuery` doit nommer une requête de `ViewSpec.queries` avec `"lazy": true` et une variable GraphQL `$nodeId: ID!`.
  `detailIdField` choisit le champ du nœud passé à cette variable (défaut `id`).

`scopedResolver` (`views/data.ts`) chaîne ces portées : `$item` (accordéon imbriqué) → `$node` → `$detail` → résolveur de la vue.

## Moteur (`apps/frontend/src/views`)

- `graphSession/` : store en mémoire par provider, clé `${viewId}|${widgetId}|${query}`. `toggleExpanded`,
  `setCollapsedGroup`, `setFocus`, `setOverride` sont des fonctions pures testées. Le provider est monté dans
  `app/PluginRuntime.tsx`. Aucune écriture dans le ViewSpec ni dans un stockage du navigateur.
- `useNodeDetail.ts` : exécute la requête lazy via `queryRunner`, valide avec zod, met en cache pour la session et ignore
  les réponses périmées. `useViewData.ts` exclut les requêtes `lazy` du chargement initial et du `refetch`.
- `widgets/graphExplorer/graphExplorerModel.ts` : construction du réseau, repli des groupes (`groupByField`), focus,
  `initialCollapsedGroups`, limites d'ouverture et lecture de `$nodeId`. Logique pure, testée.
- `widgets/graphExplorer/graphExplorerFlow.ts` : positions et deux variantes de nœud (`graphNode` / `expandedNode`).
  Le nœud ouvert **garde le même id** : les arêtes restent attachées à la boîte.
- `widgets/graphExplorer/ExplorerCanvas.tsx` : React Flow. Les widgets imbriqués sont dans la zone `nodrag nowheel`
  de la boîte ; les ids sont préfixés par le nœud pour éviter les collisions de ports.
- Le layout réutilise `network/useNetworkLayout` (ForceAtlas2 en worker ou dagre). Les nœuds ne sont pas déplaçables
  dans cette première version ; seul le pan/zoom du canvas est disponible.

## Pourquoi React Flow et pas sigma ?

Le critère qui tranche est la boîte ouverte : elle doit être un composant React dans le viewport transformé, pas un
overlay DOM au-dessus d'un canvas WebGL. sigma/graphology reste le bon moteur pour `network` (grands réseaux), et n'est
pas modifié. React Flow est chargé en lazy avec sa feuille de style (`widgets/graphExplorer/lazy.tsx`).

## Limites et suites possibles

- Un nœud DOM par élément visible : au-delà de quelques milliers de nœuds, préférer `network`. Le culling est activé
  au-dessus de 300 nœuds et le nombre de boîtes ouvertes est limité.
- Zoom et positions ne sont pas persistés ; les groupes repliés au départ viennent de `collapseAbove` / `overview: "tree"`.
- Le detail query n'est exécutée qu'une fois par nœud pour la session ; un rechargement de page la refait.
- Une collection de plugins peut fournir ses propres presets en réutilisant le normaliseur et les ports `$node`/`$detail`.
