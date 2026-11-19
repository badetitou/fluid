# fluid dans un hôte MCP : le viewer (`ui://fluid/viewer`)

`fluid mcp` (voir `apps/cli/src/mcp/`) expose l'outil `show_view`. Son résultat est affiché par
une MCP App (spec 2026-01-26) : une page HTML servie comme ressource `ui://fluid/viewer`
(MIME `text/html;profile=mcp-app`) et rendue par l'hôte dans une iframe.

## Le viewer

- Entrée de build : `apps/frontend/viewer.html` + `src/app/mcp-viewer/` (couche `app`), config
  `apps/frontend/vite.viewer.config.ts`, commande `pnpm --filter @fluid/frontend build:viewer`
  (sortie `apps/frontend/dist-viewer/viewer.html`).
- Un seul fichier HTML : JS et CSS inline (`vite-plugin-singlefile`), chunks paresseux inclus.
  Aucun chargement externe : la ressource ne déclare aucun `connectDomains` / `resourceDomains`.
- `pnpm pack:cli` copie le fichier dans le paquet (`dist/viewer.html`, chemin donné par
  `layout.ts`). Depuis les sources, sans fichier construit, `fluid mcp` sert l'ancien
  placeholder et le dit sur stderr.

## Protocole

`bridge.ts` est un petit client JSON-RPC sur `postMessage` (pas le SDK `ext-apps` : il tirerait
le SDK MCP complet dans la page). Poignée de main : `ui/initialize` (le `hostContext` de la
réponse donne le thème) puis `ui/notifications/initialized`. L'hôte envoie
`ui/notifications/tool-result` (le résultat de `show_view`) et
`ui/notifications/host-context-changed` ; la page envoie `tools/call` (`run_queries`) et
`ui/notifications/size-changed` (ResizeObserver). Seuls les messages dont la source est
`window.parent` sont lus, tous validés par zod ; le `structuredContent` de `show_view`
(`{ viewId, sourceId, take, spec, data }`) aussi.

Les messages sortants utilisent `targetOrigin: '*'` : l'hôte passe par un proxy de bac à sable
dont l'origine est opaque pour la vue. Seules des données non secrètes sont postées (noms
d'outils, ids de vue et de source, `take`, variables de la vue, tailles). Chaque requête a un
délai (10 s pour `ui/initialize`, 30 s pour `tools/call`), et `dispose()` (démontage ou
`ui/resource-teardown`) rejette les requêtes en attente. Rien n'est envoyé avant la fin de la
poignée de main. Un résultat d'outil en erreur s'affiche en bandeau sans remplacer la dernière
vue valide. Le viewer n'utilise pas `StrictMode` (une seule poignée de main).

## Données sans réseau

Le moteur (`ViewRenderer`) tourne inchangé. Son client urql n'a qu'un échange terminal
(`viewerExchange.ts`) : chaque requête est retrouvée par son texte dans `spec.queries`, puis
`ViewerData` (pur, testé) répond depuis les résultats de `show_view`. Ce qui n'y est pas
(plus de lignes que `take`, d'autres variables : « charger plus ») passe par
`tools/call run_queries` et met à jour le cache. Requête inconnue ou mutation : résultat d'erreur. Le cache est indexé par requête et variables
(hors `take`) ; le serveur applique toujours son `take` (100 par défaut) aux requêtes qui le
déclarent, c'est donc celui du premier run. Un `take` plus petit est servi depuis le cache en
coupant les listes paginées ; un plus grand relance `run_queries`. Les relances identiques en
cours sont fusionnées, et sans variables la réponse alimente le cache de toutes les requêtes.
Le viewer ne fournit pas d'`offsetArg` : la pagination se fait par un `take` plus grand
(chaque `run_queries` relance toutes les requêtes de la vue, la réponse est limitée à 256 Ko).

## Écrire des vues (`draft_view`, `save_view`)

- `get_source_schema` (modèle) : le SDL de la source (introspection par le BFF, sans descriptions,
  coupé à 60 000 caractères), pour que l'assistant écrive des requêtes valides.
- `draft_view` (modèle + app) : sa description porte le format du brouillon, `renderWidgetDocs` et
  `renderPortDocs` du catalogue MCP (`mcpWidgetCatalog` : les widgets intégrés sauf network, 3D et
  insight, que le viewer ne dessine pas) et `VIEW_DRAFT_TYPES_DOC` (LinkConfig, Transform, Format),
  partagé avec les prompts du BFF. Arguments : `sourceId`, `concept`, `request` (la demande de
  l'utilisateur, gardée comme `intent` de la vue) et `view` (le brouillon).
- Le BFF (`POST /api/views/draft`, `views/draft-service.ts`) valide le brouillon avec
  `validateDraftValue`, le même code que l'assistant intégré (zod, catalogue, câblage, actions
  contre les mutations de la source), vérifie chaque requête contre le schéma introspecté (gardé
  5 min par source), puis lance les requêtes avec les règles d'une vue enregistrée
  (`runSpec` : lecture seule, plafonds). Réponse `{ spec, results, issues }` (comme `/run`) ; un brouillon refusé
  donne un 422 avec ses `issues`, rendues au modèle en erreur d'outil pour qu'il corrige.
- Le viewer affiche un aperçu (titre et une carte par widget) pendant que le modèle écrit
  (`ui/notifications/tool-input-partial`), puis la vue et ses `issues`, avec un bouton
  « Save in fluid » qui appelle `save_view` (app seulement ; `POST /api/views/from-draft`, même
  validation, refusé si une requête ne passe pas le schéma). Une fois enregistrée, la vue a un id :
  « charger plus » passe par `run_queries` comme pour `show_view`. Avant, un brouillon ne sert que
  les lignes déjà reçues.

## Le viewer dans la conversation

- **Sélection** : `ViewRenderer` accepte un store de sorties (`outputs`) ; le viewer en crée un par
  vue et le lit (`useSelectionContext`). Les sorties `selected` des widgets, compactées
  (`selectionModel.ts` : 20 clés, 10 éléments, chaînes de 200 caractères, profondeur 3, 4 000
  caractères au plus), partent en `ui/update-model-context` 400 ms après le dernier changement,
  avec une phrase qui les présente comme des données de la source, pas des instructions.
- **Ask about this** : poste la sélection comme message de l'utilisateur (`ui/message`).
- **Liens** : les widgets naviguent dans le `MemoryRouter` du viewer ; `LinkWatcher` lit le
  chemin (`/<Concept>@<id>`), revient à `/`, puis le viewer cherche une vue enregistrée du concept
  (`list_views`, visible par l'app ; une vue `detail` pour un élément) et l'affiche sur place avec
  `show_view` (`variables: { id }`, injecté dans les requêtes qui déclarent `$id` comme dans les
  colonnes de l'app). Un bouton « Back » revient aux vues précédentes (20 au plus). Sans vue,
  `ui/open-link` ouvre l'élément dans fluid (`fluidUrl` du résultat, l'URL donnée à `fluid mcp`).
- **Plein écran** : `ui/request-display-mode` ; le bouton n'apparaît pas si l'hôte annonce des
  `availableDisplayModes` sans `fullscreen`. En plein écran, la grille passe à 3 colonnes.

## Actions de vue (`invoke_action`)

- `invoke_action` est visible par l'app seulement : le modèle ne peut pas lancer une mutation.
- Le BFF n'exécute que l'action enregistrée de la vue (`POST /api/views/:id/actions/:action`,
  `views/action-service.ts`) : la clé et les variables résolues (`$target`, `$form` remplacés par le
  moteur) arrivent, jamais le texte d'une mutation ; le document doit être une seule opération
  `mutation`, et seules ses variables déclarées passent.
- Écriture : la source doit avoir `allowWrites` (colonne de `SourceConfig`, désactivée par défaut,
  remise à `false` quand l'URL change d'origine). C'est le réglage « Allow changes » de l'app
  (`useSourceWrites`), envoyé au BFF pour une source routée par lui, et repris à la création de la
  config BFF. Sinon 403. `show_view` dit au viewer si la source l'accepte (`writable`).
- La route refuse toute requête portant un en-tête `Origin` (403) : seul le serveur MCP (processus
  local) l'appelle, une page web ne peut pas déclencher d'écriture sans la confirmation du viewer.
- Chaque run est journalisé dans la table `ActionLog` (vue, action, source, variables, succès,
  réponse coupée au-delà de 8 Ko).
- Viewer : sans `writable` ou pour un brouillon non enregistré, la vue est en lecture seule. Sinon
  chaque action reçoit une confirmation (`actionModel.ts`) qui nomme toujours les champs de mutation
  appelés (le `confirm` et le `label` d'une vue écrite par un assistant ne peuvent pas les cacher),
  une suppression dit qu'elle efface des
  données de la source et que c'est définitif ; le moteur la pose (`useViewActions`), puis
  l'échange urql du viewer retrouve l'action par le texte de sa mutation et appelle
  `invoke_action`. Le patch local et les `refetch` du moteur s'appliquent comme dans l'app.

## Thème

Le thème du contexte hôte (`light` / `dark`) choisit la variante du thème intégré
(`viewerTheme.ts`) ; `host-context-changed` le met à jour.

## Widgets lourds : décision

Taille du fichier unique, mesurée avec `FLUID_VIEWER_STUB=<dossiers>` (widgets remplacés par un
message « not available in this host ») :

| Widgets exclus                    | Taille    | gzip      |
| --------------------------------- | --------- | --------- |
| aucun                             | 4,26 Mo   | 1,25 Mo   |
| network                           | 4,02 Mo   | 1,19 Mo   |
| **network + 3D (retenu)**         | **3,42 Mo** | **1,04 Mo** |
| network + 3D + code + richtext    | 3,15 Mo   | 0,96 Mo   |

- **network** exclu : ForceAtlas2 et la mise en couches tournent dans des web workers, que le
  bac à sable de l'hôte (CSP sans `worker-src`) interdit ; le widget ne fonctionnerait pas.
- **3D** exclu : three.js pèse ~0,6 Mo (14 %) pour des widgets rares dans un panneau de chat.
- **code** et **richtext** inclus : ~0,27 Mo ensemble, et le Markdown est courant.
- Le socle (antd, graphiques G2, moteur) fait déjà 3,15 Mo : la limite du smoke test est 4 Mo.

Pour inclure un widget exclu, retirer son dossier de `STUBBED` dans `vite.viewer.config.ts`
(le network demande en plus de remplacer les workers).

## Essayer dans un hôte

Voir le README du CLI ; en résumé : fluid lancé avec une vue enregistrée, `pnpm pack:cli`, puis
`fluid mcp` déclaré dans l'hôte (Claude Desktop, MCP Inspector, ou le `basic-host` d'ext-apps).
