# 🎯 Infinite Navigation Feature - Mock & Demo

## Quick Start: Test the Feature

### 1. Access the Demo Page
Navigate to: `http://localhost:5173/demo`

Or if you have a running app, you can go directly to this route.

This page demonstrates the infinite navigation feature **without needing a GraphQL backend**.

### 2. What You'll See

The demo page shows:

1. **Accounts List** - A table with Account IDs as clickable links
2. **Account Detail** - Shows account information with links to customers and orders
3. **Customer Detail** - Shows customer info with links back to accounts (bidirectional!)
4. **Order Detail** - Shows order details with links to accounts and customers
5. **Navigation Flow Diagram** - Visual representation of how infinite navigation works

### 3. Click the Links to Navigate

The links in the demo are **fully functional**. Try this flow:

```
Accounts List
  ↓ Click "ACC-001"
Account Detail (ACC-001)
  ↓ Click "John Doe" (customer)
Customer Detail (CUST-001)
  ↓ Click "ACC-003" (another account)
Account Detail (ACC-003)
  ↓ Click "John Doe" (same customer)
Customer Detail (CUST-001)
  ↓ ... Continue infinitely!
```

---

## 📂 Files Created for Testing

### Mock Data
- **`src/graphql/mockGraphqlData.ts`** - Mock GraphQL responses
  - Contains sample data for accounts, customers, orders, products
  - Functions to retrieve data by ID

### Mock Views  
- **`src/views/mockViews.ts`** - Mock view specifications
  - Defines views with `linkTo` configuration
  - Shows how to structure navigation links

### Mock Hook
- **`src/hooks/useMockViews.ts`** - Mock version of useViews hook
  - Returns mock views without needing the BFF
  - Simulates loading delay

### Demo Component
- **`src/pages/NavigationFeatureDemo.tsx`** - Interactive demo
  - Shows accounts, customers, orders with clickable links
  - Demonstrates the feature without a GraphQL backend
  - Fully functional navigation

---

## 🔍 How the Feature Works

### Configuration Example

When you create a view with navigation links:

```json
{
  "type": "table",
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

This configuration tells Fluid:
- Render the `id` column as a **link**
- Link points to `/concept/Account/item/{idValue}`
- The `customerId` column links to `/concept/Customer/item/{idValue}`

### Navigation Flow

```
URL: /concept/Account
  ↓ TableWidget renders with linkTo
  ├─ Column "id" → <Link to="/concept/Account/item/ACC-001">
  └─ Click → Navigate

URL: /concept/Account/item/ACC-001
  ↓ ItemPage receives parameters
  ├─ conceptName = "Account"
  ├─ itemId = "ACC-001"
  └─ Injects ID into query variables

Query Execution:
  ├─ accountById(id: "ACC-001")
  └─ Returns account details with related objects

Render Widgets:
  ├─ Descriptions with customer link
  ├─ Table of orders with order links
  └─ Continue navigating infinitely!
```

---

## 🧪 Test Scenarios

### Test 1: Table Navigation
1. Go to `/demo`
2. See "Accounts List" section
3. Click on "ACC-001" (Account ID)
4. See it's a link (blue text)
5. Click it → Navigates to `/concept/Account/item/ACC-001`

### Test 2: Bidirectional Navigation
1. Start at Account Detail (ACC-001)
2. Click "John Doe" (Customer link)
3. See Customer Detail (CUST-001)
4. Click "ACC-003" (Account link in related accounts)
5. See Account Detail (ACC-003)
6. You can navigate back to the customer again → **Bidirectional!**

### Test 3: Deep Navigation
1. Start at Accounts List
2. Click Account → Customer → Back to Account → Order → ...
3. Keep clicking links
4. There's **no limit** on how deep you can go

### Test 4: Description Links
1. Look at Account Detail
2. See "Customer" field is a link
3. Click it to navigate to Customer Detail
4. Descriptions also support `linkTo`!

---

## 🛠️ Integration with Your Backend

To use this with your real GraphQL backend:

### Step 1: Create Views with `linkTo`

In your BFF, create views that include the `linkTo` property:

```typescript
const accountListView: ViewSpec = {
  version: 1,
  id: 'accounts-list',
  concept: 'Account',
  title: 'Accounts',
  queries: {
    accounts: {
      query: 'query { accounts { id name customerId customer { id name } } }',
    },
  },
  widgets: [
    {
      type: 'table',
      id: 'table',
      data: { query: 'accounts', path: 'accounts' },
      columns: [
        {
          key: 'id',
          title: 'ID',
          linkTo: { concept: 'Account' },  // ← Add this!
        },
        {
          key: 'customerId',
          title: 'Customer',
          linkTo: { concept: 'Customer', idField: 'customerId' },  // ← Add this!
        },
      ],
    },
  ],
};
```

### Step 2: Ensure Your GraphQL Schema Has "by ID" Queries

Each concept must have a query that returns a single object by ID:

```graphql
type Query {
  accounts: [Account!]!              # List query
  accountById(id: ID!): Account      # By-ID query ← REQUIRED!
  
  customers: [Customer!]!             # List query
  customerById(id: ID!): Customer    # By-ID query ← REQUIRED!
}
```

### Step 3: Test with Real Data

Once configured:
1. Go to `/concept/Account`
2. Click on an Account ID
3. See `/concept/Account/item/XXX`
4. See the account details loaded via `accountById(id: XXX)`
5. Click on customer or order links
6. Navigate infinitely!

---

## 📝 Implementation Details

### Files Modified
```
✅ packages/shared/src/view-spec.ts
   - Added linkTo to Column
   - Added linkTo to DescriptionsWidget items

✅ apps/frontend/src/views/widgets/TableWidget.tsx
   - Renders <Link> if column has linkTo

✅ apps/frontend/src/views/widgets/DescriptionsWidget.tsx
   - Renders <Link> if item has linkTo

✅ apps/frontend/src/App.tsx
   - Added route: /concept/:conceptName/item/:itemId
   - Added demo route: /demo

✅ apps/frontend/src/pages/ItemPage.tsx
   - New component for item detail views
   - Injects ID into query variables
```

### Files Created for Testing
```
✅ apps/frontend/src/graphql/mockGraphqlData.ts
   - Mock data for all entities

✅ apps/frontend/src/views/mockViews.ts
   - Mock view specifications with linkTo

✅ apps/frontend/src/hooks/useMockViews.ts
   - Mock hook for useViews

✅ apps/frontend/src/pages/NavigationFeatureDemo.tsx
   - Demo component with clickable links
```

---

## ✨ Key Features Demonstrated

1. ✅ **Table Column Links** - Click Account ID to view details
2. ✅ **Description Links** - Click Customer name to view customer
3. ✅ **Bidirectional Navigation** - Navigate back and forth between related objects
4. ✅ **Infinite Depth** - No limit to navigation depth
5. ✅ **Multiple Concepts** - Navigate between different types (Account → Customer → Order)
6. ✅ **Nested Path Fields** - Support for `customer.id` style ID fields

---

## 🚀 Next Steps

1. **Test the Demo** - Go to `/demo` and click around
2. **Verify LinkTo Works** - See the blue links in tables and descriptions
3. **Check Navigation** - Verify URLs change to `/concept/Account/item/XXX`
4. **Integrate with Backend** - Create views with `linkTo` in your BFF
5. **Deploy** - Use with your real GraphQL schema

---

## 💡 Pro Tips

### Using Nested Paths for IDs

If your data has nested IDs (like `customer.id`), use:
```json
{
  "key": "customer.name",
  "linkTo": {
    "concept": "Customer",
    "idField": "customer.id"  ← Nested path!
  }
}
```

### Default ID Field

If you omit `idField`, it defaults to `"id"`:
```json
{
  "key": "id",
  "linkTo": {
    "concept": "Account"
    // Automatically uses idField: "id"
  }
}
```

### Creating Cycles

You can create navigation cycles intentionally:
```
Account → Customer → Account → Customer → ...
```

This enables exploring relationships from multiple angles!

---

## 🐛 Troubleshooting

### Links aren't showing up
- Check that your view has `linkTo` configured on the column/item
- Verify the structure: `{ concept: "Account", idField?: "id" }`

### Navigation fails with 404
- Make sure your concept has a "by ID" query in the schema
- Check that the parameter name matches (`id` by default)

### Data doesn't load
- Verify the query parameter is being passed
- Check browser DevTools → Network to see GraphQL request
- Confirm the query variable is included: `{ id: "XXX" }`

---

## 📚 Documentation

See also:
- `NAVIGATION_FEATURE.md` - Full feature documentation
- `mockViews.ts` - View configuration examples
- `mockGraphqlData.ts` - Data structure examples

---

**Ready to test? Go to `/demo` and start clicking!** 🎉
