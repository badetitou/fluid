# Mutations : modifier les données depuis fluid

> Statut : **étapes 1 à 5 livrées** (2026-10-22). Ce document fixe comment fluid écrit dans l'API
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

La vérification des champs appelés contre le schéma de la source est faite côté BFF (§8).

## 6. Exécution dans le moteur (étape 3)

Dans `apps/frontend/src/views/actions/` (moteur) :

- `model.ts` (pur, testé) : `resolveActionVariables` remplace `$target` / `$form` ; `patchResults`
  fusionne (en profondeur) chaque objet renvoyé par la mutation dans toutes ses copies des résultats
  de la vue — même `id` et, quand les deux le disent, même `__typename` (urql l'ajoute aux requêtes) —
  et retire la cible d'une suppression des listes qui la contiennent. Un objet créé n'est pas inséré :
  c'est le rôle de `refetch`.
- `useViewActions(spec, view)` : `run(key, { target, form })` demande la confirmation (`confirm`,
  modale antd), résout les variables, appelle `client.mutation`, patche les résultats
  (`useViewData().patch`), relance `refetch` en `network-only` (`useViewData().refetch`), et signale
  succès ou erreur par un message. Il ne lève jamais : il renvoie `ActionResult`.
- `WidgetProps.invoke?(action, { target, form })` : fourni par `ViewActionsContext` (posé par
  `ViewRenderer`) **seulement** si la source accepte l'écriture et que la vue a des actions ;
  sinon absent, et le widget s'affiche en lecture.
- Écriture par source : `useWritableSources` (store persistant, clé = URL GraphQL), réglée dans
  *Settings → Connection → Allow changes* via `useSourceWrites`, transmise au moteur par
  `WriteAccessContext` (posé dans `App.tsx` ; `false` sans fournisseur).

Depuis un hôte MCP (viewer `ui://fluid/viewer`), les actions passent par le BFF et l'outil
`invoke_action` ; l'écriture y dépend du drapeau `allowWrites` de la source côté BFF (voir `MCP.md`).

Limites connues :
- GraphQLZero n'enregistre rien : un `refetch` (ou un remontage de la vue) affiche à nouveau
  l'ancienne valeur. Sans `refetch`, le patch local reste affiché.
- La clé d'identité est `id` ; une source qui identifie autrement (`code`…) ne sera pas patchée.
- L'aperçu de l'assistant de vue rend aussi les actions : un clic y écrit vraiment.

## 7. Widgets d'édition, collection `editing` (étape 4)

Collection intégrée **`fluid-editing`** (*Editing*), activée par défaut comme les autres.

- **`form`** (`packages/shared/src/widgets/form.ts`, rendu dans `views/widgets/form/`) :
  `{ type: "form", data?, action, fields?, submitLabel?, reset? }`.
  - `data` : l'objet édité ; il préremplit les champs et devient `$target`. Sans `data`, le
    formulaire crée (et se vide après succès, sauf `reset: false`).
  - `fields` : `{ key, label?, input?, options?, required? }` ; `input` ∈ `text`, `textarea`,
    `number`, `boolean`, `date` (chaîne ISO), `select`. Sans `fields`, les champs sont **déduits du
    type d'entrée** que l'action remplit avec `$form` (`formInputType` lit le type déclaré de la
    variable, `useInputType` l'introspecte) : scalaires et enums, ni listes ni objets imbriqués.
    Avec `fields`, le type d'entrée complète seulement le genre de contrôle.
  - Un interrupteur non touché vaut `false` (sinon un `Boolean!` requis manquerait).
  - Tant qu'il ne peut pas soumettre (pas d'`invoke`, action inconnue, rien de lié), le formulaire
    s'affiche désactivé avec la raison.
- **`table.rowActions`** : `[{ action, label?, danger? }]`, une colonne de boutons qui lancent l'action
  avec la ligne comme `$target`. Masquée sans `invoke`. Le clic sur un bouton ne sélectionne pas la ligne.
- **`WidgetContract.actions`** : `ActionSlot[]` (`{ name, description }`), les champs de config par
  lesquels un widget nomme des actions — une clé (`form.action`) ou une liste de `{ action }`
  (`table.rowActions`). `checkActionReferences` s'en sert pour signaler une action nommée mais non
  déclarée ; le BFF l'applique aux vues générées. Un plugin déclare les siens dans son manifeste.
- `useViewAction(key)` (moteur) donne la déclaration d'une action, pour un libellé ou un formulaire.
- Exemples curated (GraphQLZero) : `todoListExample` (table avec *Done* / *Delete*, formulaire
  *New todo*) et `todoEditExample` (détail avec formulaire d'édition).
- Plus tard : édition en place dans `descriptions`, options des enums dans `select`.

Correctif au passage : le client urql envoie toujours ses requêtes en POST (`preferGetMethod: false`).
GraphQLZero (Apollo) refuse les GET comme CSRF potentiel, ce qui cassait déjà l'introspection de cette source.

## 8. LLM et vues automatiques (étape 5)

**Ce que le frontend envoie** (`ConceptSchemaPayload`, construit par `useConceptSchema`) :
- `mutations: MutationInfo[]` : les mutations du concept (create / update / delete d'abord, 8 au plus),
  avec leur signature et les champs de leur objet d'entrée (`buildMutationInfos`, types d'entrée lus par
  `useMutationInputs`) ;
- `mutationFields` : **tous** les champs racine de `Mutation` de la source, pour la validation ;
- pour l'agent de widget, `viewActions` (clé → document) : les actions de la vue.

**Prompts** (`packages/shared/src/actions/llm.ts`, testé) : `renderActionsSection(mutations)` documente
`actions` (forme, références `$target` / `$form`, `confirm` obligatoire pour une suppression, sélection
de l'objet écrit) et liste les mutations du concept ; sans mutation, il interdit `actions`, `form` et
`rowActions`. Il est ajouté aux deux prompts de vue (générique, section `ACTIONS:` ; Claude, section
`<actions>`), et le contrat de la vue gagne `"actions"?`. Les prompts de widget listent les actions de
la vue (`renderViewActions`, `apps/bff/src/llm/viewActionsPrompt.ts`) : un widget ne peut qu'en utiliser
une, pas en déclarer.

**Validation BFF** (avant le tour de réparation) :
- `checkActionFields(actions, mutationFields)` : chaque champ appelé par une action existe dans le type
  `Mutation` de la source (rien n'est vérifié si le frontend n'a pas envoyé `mutationFields`) ;
- `checkActionReferences` : les actions nommées par les widgets sont déclarées (vue), ou font partie des
  actions de la vue (widget). Le frontend refait ce contrôle sur la proposition de l'agent de widget.

**Vue détail automatique** : quand la source accepte l'écriture, `withEditForm` (`views/editView.ts`)
ajoute l'action `update` et un formulaire *Edit* lié à l'élément affiché, dont les champs viennent du type
d'entrée. Seulement si la mutation `update` du concept se laisse appeler ainsi : argument clé et argument
d'entrée connus avec leur type, aucun autre argument requis, et une réponse qui est l'élément lui-même.

## 9. Étapes

| # | Contenu | État |
| --- | --- | --- |
| 1 | Introspection des mutations, classement par concept, types d’entrée (requête + modèle ; hook `useInputType` à l’étape 4) | ✅ |
| 2 | `actions` dans le ViewSpec (schéma, validation) | ✅ |
| 3 | `useViewActions`, patch local, `invoke` dans `WidgetProps`, réglage « écriture » par connexion | ✅ |
| 4 | Collection `editing` : widget `form`, `table.rowActions`, `WidgetContract.actions`, hook des types d'entrée | ✅ |
| 5 | LLM (prompts, validation BFF) et vue détail automatique | ✅ |
| — | En-têtes d'authentification par connexion (indépendant) | à faire |
