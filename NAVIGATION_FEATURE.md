# Navigation Infinie (Miller List) - Feature Documentation

## 🎯 Objectif

Permettre la navigation infinie entre les objets dans Fluid, comme dans une Miller list traditionnelle:
- Cliquer sur un ID → page détail
- Dans le détail, cliquer sur une relation → aller au détail de cette relation
- Continuer indéfiniment...

## ✅ Implémentation

### 1. Schéma de données (packages/shared/src/view-spec.ts)

#### Nouvelle propriété: `Column.linkTo`
```typescript
{
  concept: string;      // Concept cible (ex: "Customer")
  idField?: string;     // Chemin du champ ID (défaut: "id")
}
```

#### Nouvelle propriété: `DescriptionsWidget.items[].linkTo`
```typescript
{
  concept: string;      // Concept cible
  idField?: string;     // Chemin du champ ID (défaut: "id")
}
```

### 2. Widgets Frontend

#### TableWidget (apps/frontend/src/views/widgets/TableWidget.tsx)
- Détecte si `column.linkTo` est défini
- Rend le contenu en `<Link to="/concept/{concept}/item/{idValue}">`
- Supporte les chemins imbriqués pour `idField` (ex: `customer.id`)

#### DescriptionsWidget (apps/frontend/src/views/widgets/DescriptionsWidget.tsx)
- Détecte si `item.linkTo` est défini
- Rend le contenu en `<Link>`
- Supporte les chemins imbriqués pour `idField`

### 3. Routing (apps/frontend/src/App.tsx)

Nouvelle route:
```
/concept/:conceptName/item/:itemId
```

Pointe vers `ItemPage` qui affiche les détails d'un objet spécifique.

### 4. ItemPage (apps/frontend/src/pages/ItemPage.tsx)

Nouveau composant qui:
- Accepte `conceptName` et `itemId` via les paramètres URL
- Récupère le concept via introspection
- Récupère les vues du concept
- Utilise `ItemViewRenderer` pour injecter l'ID dans la query "by ID"
- Affiche les widgets avec `ViewRenderer`

## 📋 Configuration d'une vue avec navigation

### Exemple 1: Table avec liens (Accounts)

```json
{
  "type": "table",
  "id": "accounts-list",
  "columns": [
    {
      "key": "id",
      "title": "Account ID",
      "linkTo": {
        "concept": "Account",
        "idField": "id"
      }
    },
    {
      "key": "customerId",
      "title": "Customer",
      "linkTo": {
        "concept": "Customer",
        "idField": "customerId"
      }
    }
  ]
}
```

### Exemple 2: Descriptions avec liens (Account Detail)

```json
{
  "type": "descriptions",
  "id": "account-details",
  "items": [
    { "label": "ID", "key": "id" },
    {
      "label": "Customer",
      "key": "customer.name",
      "linkTo": {
        "concept": "Customer",
        "idField": "customer.id"
      }
    }
  ]
}
```

## 🚀 Flux de navigation typique

```
/concept/Account (liste)
  ↓ clique sur Account ID
/concept/Account/item/ACC-001 (détail)
  ↓ clique sur Customer ID
/concept/Customer/item/CUST-42 (détail)
  ↓ clique sur Order ID
/concept/Order/item/ORD-999 (détail)
  ↓ ...infini
```

## 🔧 Configuration requise

Pour qu'un concept supporte la navigation item:

1. **Query "by ID"** (autodécouverte)
   - Exemple: `accountById(id: ID!): Account`
   - L'introspection détecte automatiquement les queries retournant UN objet (pas une liste)

2. **Vues avec `linkTo`**
   - Créez des vues qui utilisent `linkTo` sur les colonnes ou items

3. **Aucune modification du backend**
   - Utilise le GraphQL schema existant

## ✨ Caractéristiques

- ✅ **Pas de limite de profondeur** - Naviguez aussi profondément que vous voulez
- ✅ **URLs directes** - `/concept/Account/item/ACC-001` est bookmarkable et shareable
- ✅ **Bidirectionnel** - Créez des cycles de navigation (A → B → A)
- ✅ **Autodécouverte** - Les queries "by ID" sont détectées automatiquement
- ✅ **Flexible** - Supporte les chemins imbriqués (`customer.id`)
- ✅ **Tous les widgets** - Table, Descriptions, Charts, etc.

## 📂 Fichiers modifiés

```
packages/shared/src/view-spec.ts
  - Ajouté linkTo à Column
  - Ajouté linkTo aux items de DescriptionsWidget

apps/frontend/src/App.tsx
  - Ajout de la route /concept/:conceptName/item/:itemId

apps/frontend/src/pages/ItemPage.tsx
  - NOUVEAU: Affiche les détails d'un objet spécifique

apps/frontend/src/views/widgets/TableWidget.tsx
  - Support du linkTo sur les colonnes

apps/frontend/src/views/widgets/DescriptionsWidget.tsx
  - Support du linkTo sur les items
```

## 🧪 Test

1. Créer une vue avec `linkTo` sur une colonne/item
2. Sauvegarder la vue dans la BFF
3. Naviguer vers `/concept/Account`
4. Cliquer sur un lien
5. Vérifier que vous êtes à `/concept/Account/item/XXX`
6. Voir les données chargées
7. Cliquer sur un autre lien
8. Navigation infinie! ✅

## 📝 Notes

- **Argument ID par défaut**: `id` (mais le code essaie aussi d'autres noms)
- **Chemins imbriqués**: `idField: "customer.id"` fonctionne
- **Fallback**: Si aucune query n'est configurée dans la vue, une query basique est générée
- **Erreurs**: Les erreurs GraphQL sont affichées comme des alertes
- **Breadcrumbs**: Utilisez les breadcrumbs pour naviguer en arrière

---

**La navigation infinie est maintenant possible! 🎉**
