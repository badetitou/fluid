# Mutations : modifier les données depuis fluid

> Statut : **étapes 1 et 2 livrées** (2026-10-22). Ce document fixe comment fluid écrit dans l'API
> GraphQL à laquelle il est connecté. Il s'appuie sur `PLUGINS.md` (contrats, ports, `@<widgetId>`).

## 1. Constat

fluid ne fait que lire :

- `ViewSpec.queries` déclare des requêtes nommées, exécutées une fois au montage par `useViewData`
  (`client.query(...).toPromise()`, sans abonnement) ;
- l'introspection ne lit que `queryType` ; `Mutation` n'est cité que pour être exclu des concepts ;
- les widgets communiquent par `emit` / `@<widgetId>`, mais rien ne déclenche d'action ;
- la connexion n'envoie aucun en-tête (pas d'`Authorization`) ;
- parmi les sources de démo, seule **GraphQLZero** expose des mutations
  (`createX(input)`, `updateX(id, input)`, `deleteX(id)`), et elles sont **factices** : la réponse
  contient l'objet modifié, mais rien n'est enregistré côté serveur.

## 2. Principes

- **Déclaratif** : une mutation est décrite dans le ViewSpec (`actions`), comme une requête. Elle peut
  être écrite à la main, générée par le LLM, enregistrée et rejouée.
- **Jamais sans l'utilisateur** : une mutation ne part que sur un clic. Les suppressions demandent
  une confirmation. Le LLM peut *proposer* une action, jamais l'exécuter.
- **Lecture seule par défaut** : l'écriture s'active par connexion (*Settings → Connexion*). Tant
  qu'elle est désactivée, les widgets d'édition s'affichent en lecture seule.
- **Le cœur ne connaît que des contrats** : un widget d'édition est un widget comme les autres
  (collection `editing`) ; un plugin peut en fournir.

## 3. Choix retenus

| Question | Choix | Pourquoi |
| --- | --- | --- |
| Après une mutation, comment l'écran se met-il à jour ? | **Patch local** du résultat de la vue avec la réponse de la mutation (objets identifiés par `__typename` + clé), puis `refetch` optionnel des requêtes listées | Fonctionne avec GraphQLZero (factice) et évite un aller-retour sur les vraies API |
| Une API de démo qui enregistre vraiment ? | **Non** pour l'instant | fluid n'a pas de backend GraphQL à lui ; le patch local suffit pour la démo |
| Authentification | **Étape à part** (en-têtes personnalisés par connexion) | Indispensable hors démo, mais indépendant du reste |
| Premier point d'entrée dans l'UI | **Widget `form`** alimenté par `@<table>.selected`, puis actions de ligne sur `table` | Passe par les contrats existants ; l'édition en place dans `descriptions` viendra après |

## 4. Découverte des mutations (étape 1)

`ROOT_TYPE_QUERY` lit aussi `mutationType { name }`. Le type racine des mutations est introspecté
comme celui des requêtes (même profondeur, `deep` puis `shallow`).

Chaque champ de mutation est rattaché à un concept et classé, en logique pure
(`graphql/mutations.ts`, testé) :

```ts
interface ConceptMutation {
  field: string;            // 'updateTodo'
  kind: 'create' | 'update' | 'delete' | 'other';
  args: MutationArg[];      // { name, type: 'ID!', typeName: 'UpdateTodoInput', isInput: true }
  idArg?: string;           // argument clé (update/delete) : 'id'
  inputArg?: string;        // argument objet d'entrée : 'input'
  returnsConcept: boolean;  // la réponse est l'objet modifié (patchable)
}
interface ConceptMutations { create?, update?, delete?: ConceptMutation; others: ConceptMutation[] }
```

Règles de classement :

1. **Concept** : le type de retour quand c'est un objet explorable ; sinon (retour `Boolean`, `ID`…),
   le nom du champ privé de son verbe (`deleteTodo` → `Todo`), s'il correspond à un concept connu.
2. **Genre** : par le verbe en tête du nom — `create|add|insert|new` → `create`,
   `update|edit|set|patch|modify|change` → `update`, `delete|remove|destroy` → `delete`, sinon `other`.
   Un champ `Payload` (`{ todo: Todo }`) n'est pas déballé à cette étape : il reste `other`.
3. **Arguments** : `idArg` = `id`, ou l'unique argument scalaire requis ; `inputArg` = l'unique
   argument de type `INPUT_OBJECT`.
4. Le premier champ de chaque genre gagne ; les suivants vont dans `others`.

Les champs d'un type d'entrée (`UpdateTodoInput`) sont lus à la demande par `inputTypeQuery`
(`__type(name) { inputFields { … } }`) et décrits par `buildInputFields` ; c'est ce que le widget
`form` utilisera pour construire ses champs.

`useRootConcepts` expose `mutationsByType: Map<string, ConceptMutations>` ; `Concept` gagne
`mutations`.

## 5. `actions` dans le ViewSpec (étape 2)

```jsonc
"actions": {
  "updateTodo": {
    "mutation": "mutation($id: ID!, $input: UpdateTodoInput!) { updateTodo(id: $id, input: $input) { id title completed } }",
    "variables": { "id": "$target.id", "input": "$form" },
    "refetch": ["todos"],
    "confirm": "Enregistrer les modifications ?"
  }
}
```

- `variables` : valeurs littérales, ou références résolues à l'exécution, à toute profondeur —
  `$target` (l'objet visé : ligne, élément affiché), `$form` (les valeurs saisies), suivis d'un
  chemin optionnel (`$target.user.id`). Une chaîne qui commence par `$$` est un littéral (`"$$5"` → `"$5"`).
- `refetch` : requêtes de la vue relancées en `network-only` après succès.
- `confirm` : texte de confirmation ; **obligatoire** dès que la mutation appelle un champ de genre `delete`.
- `label` : libellé du bouton (par défaut la clé de l'action).

Validation, dans `packages/shared/src/actions/` (testée) :

| Vérification | Où |
| --- | --- |
| Le document contient exactement une opération, une `mutation`, sans fragment, qui appelle au moins un champ | `parseMutationDocument` (lecteur minimal, `shared` n'a pas de dépendance GraphQL) |
| Chaque clé de `variables` est déclarée ; chaque variable requise (`!` sans défaut) a une valeur | `actionSpecSchema` |
| Les références `$…` sont bien formées | `actionSpecSchema` (`parseActionRef`) |
| Une suppression a un `confirm` | `actionSpecSchema` (`splitMutationName`, partagé avec l'introspection) |
| Les clés de `refetch` sont des requêtes de la vue | `checkViewActions`, appelé par le BFF (`validateDraft`) et l'éditeur JSON |

Reste pour l'étape 5 : vérifier côté BFF que les champs appelés existent dans le schéma de la source.

## 6. Exécution dans le moteur (étape 3)

- `useViewActions(spec)` (moteur, `views/`) : `run(key, { target, form })` résout les variables,
  appelle `client.mutation`, patche les résultats de la vue, puis relance `refetch`.
  La logique de résolution et de patch est pure (`actions/model.ts`) et testée.
- `WidgetProps` gagne `invoke(action: string, context): Promise<ActionResult>` ;
  `WidgetContract` gagne `actions: PortSpec[]` (les actions qu'un widget sait déclencher), documentés
  au LLM comme les ports.
- Si l'écriture est désactivée pour la connexion, `invoke` est absent : le widget s'affiche en lecture.

## 7. Widgets d'édition, collection `editing` (étape 4)

- **`form`** : champs construits depuis le type d'entrée de la mutation (ou listés dans la config),
  préremplis par `data` (ex. `@todos.selected`), bouton qui déclenche `submit` → `actions.<clé>`.
- **`table.rowActions`** : boutons par ligne (supprimer, basculer un booléen) liés à une action.
- Plus tard : édition en place dans `descriptions`.

## 8. LLM et vues automatiques (étape 5)

- Le prompt reçoit la signature des mutations du concept (`ConceptMutations` + champs d'entrée)
  et la doc de `actions` ; `form` est documenté par `renderWidgetDocs`.
- La vue détail automatique (`registry.ts`) ajoute un formulaire « Modifier » quand le concept a une
  mutation `update` et que l'écriture est activée.

## 9. Étapes

| # | Contenu | État |
| --- | --- | --- |
| 1 | Introspection des mutations, classement par concept, types d’entrée (requête + modèle ; hook à l’étape 4) | ✅ |
| 2 | `actions` dans le ViewSpec (schéma, validation) | ✅ |
| 3 | `useViewActions`, patch local, `invoke` dans `WidgetProps`, réglage « écriture » par connexion | à faire |
| 4 | Collection `editing` : widget `form`, `table.rowActions` | à faire |
| 5 | LLM (prompts, validation BFF) et vue détail automatique | à faire |
| — | En-têtes d'authentification par connexion (indépendant) | à faire |
