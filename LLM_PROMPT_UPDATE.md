# 🎯 LLM Prompt Update - Infinite Navigation Feature

## What Was Updated

The LLM prompt (`apps/bff/src/llm/prompt.ts`) has been updated to make the AI aware of the **infinite navigation feature** (Miller list style).

### Before
The prompt did **not** mention `linkTo` at all, so when the LLM generated views, it would never suggest adding navigation links.

### After
The prompt now:
1. ✅ Defines the `LinkConfig` structure for the AI
2. ✅ Explains what `linkTo` does (infinite navigation)
3. ✅ Provides examples of how to use it
4. ✅ Instructs the AI to add `linkTo` to make dashboards interactive
5. ✅ Reminds the AI about nested ID paths

---

## Key Changes to the Prompt

### 1. LinkConfig Definition Added

```
LinkConfig (FEATURE: Infinite Navigation - enables Miller list-style drilling):
  "linkTo": { "concept": "<target concept name>", "idField"?: "<dot path to ID>" }
  - "concept": The target concept to navigate to (e.g., "Customer", "Order", "Product")
  - "idField": Optional dot path to extract the ID (defaults to "id"). Supports nested paths like "customer.id"
  - When a column or item has linkTo, users can click it to navigate to "/concept/{concept}/item/{id}"
  - This enables INFINITE NAVIGATION: explore related objects by clicking links in tables or descriptions
```

### 2. Updated Widget Schema

**Before:**
```json
"columns": [ { "key": string, "title"?: string, "format"?: Format } ]
```

**After:**
```json
"columns": [ { "key": string, "title"?: string, "format"?: Format, "linkTo"?: LinkConfig } ]
```

Same for descriptions items:
```json
"items": [ { "label": string, "key": string, "format"?: Format, "linkTo"?: LinkConfig } ]
```

### 3. New Rule Added

```
- NAVIGATION: When showing lists or details, add "linkTo" on ID columns and related-object fields to enable exploration
  * On table columns that contain IDs, add linkTo pointing to that concept
  * On description items that show related objects, add linkTo pointing to the related concept
  * Use nested idField like "customer.id" to point to the ID field within nested objects
```

### 4. Introductory Context

```
You can make the dashboard INTERACTIVE by adding "linkTo" to table columns and description items,
enabling users to navigate infinitely between related objects (Miller list style).
```

---

## Impact

### For the LLM

Now when the LLM generates views, it will:
- ✅ Know about the `linkTo` feature
- ✅ Understand it enables infinite navigation
- ✅ Add `linkTo` to ID columns by default
- ✅ Add `linkTo` to related object fields
- ✅ Use nested paths like `customer.id` when appropriate
- ✅ Create interactive dashboards that users can explore

### For Users

Users will now get:
- ✅ Automatically generated navigation links
- ✅ More interactive dashboards by default
- ✅ Better exploration of data relationships
- ✅ Ability to drill down infinitely through related objects

---

## Example: What the LLM Will Now Generate

### Before (without linkTo awareness)
```json
{
  "widgets": [
    {
      "type": "table",
      "columns": [
        { "key": "id", "title": "Account ID" },
        { "key": "customerId", "title": "Customer ID" },
        { "key": "name", "title": "Name" }
      ]
    }
  ]
}
```

### After (with linkTo awareness)
```json
{
  "widgets": [
    {
      "type": "table",
      "columns": [
        { 
          "key": "id", 
          "title": "Account ID",
          "linkTo": { "concept": "Account" }
        },
        { 
          "key": "customerId", 
          "title": "Customer ID",
          "linkTo": { "concept": "Customer", "idField": "customerId" }
        },
        { "key": "name", "title": "Name" }
      ]
    }
  ]
}
```

The difference: **Users can now click on IDs to navigate to related objects!** 🎯

---

## How This Works

### 1. User requests a view via the Assistant
```
"Create a dashboard for Accounts"
```

### 2. LLM receives the updated prompt
- Sees the `linkTo` documentation
- Understands how to use it
- Knows it creates interactive navigation

### 3. LLM generates the view
- Adds `linkTo` to ID columns
- Adds `linkTo` to related object fields
- Creates an interactive dashboard

### 4. User saves the view
- The view includes `linkTo` configurations
- Navigation is automatically enabled

### 5. User explores the data
```
/concept/Account (list)
  ↓ Click Account ID (thanks to linkTo!)
/concept/Account/item/ACC-001 (detail)
  ↓ Click Customer (thanks to linkTo!)
/concept/Customer/item/CUST-001 (detail)
  ↓ Click related Account (thanks to linkTo!)
/concept/Account/item/ACC-002 (detail)
  ↓ ... infinite navigation! ✅
```

---

## Testing the Update

### Step 1: Start the BFF
```bash
cd apps/bff
npm run dev
```

### Step 2: Use the Assistant to generate a view
1. Go to http://localhost:5173
2. Navigate to a concept
3. Click "Assistant" to generate a view
4. Request: "Create a dashboard with navigation links"

### Step 3: Check the generated view
The LLM should now include `linkTo` in the columns/items:
```json
"linkTo": { "concept": "SomeRelatedConcept" }
```

### Step 4: Test the navigation
- Save the view
- Click on ID links in the table
- Navigate to the detail page
- Click on related object links
- Verify infinite navigation works! 🎉

---

## Files Modified

```
✅ apps/bff/src/llm/prompt.ts
   - Added LinkConfig definition
   - Updated widget schema to include linkTo
   - Added NAVIGATION rule
   - Updated introductory context
```

---

## Summary

The LLM now knows about the infinite navigation feature and will:
- 🤖 Automatically suggest adding `linkTo` to views
- 🎯 Create interactive dashboards by default
- 🔗 Enable users to explore data relationships
- ♾️ Make infinite navigation possible through generated views

This is a **critical feature documentation** that ensures the AI takes full advantage of the platform's capabilities! 🚀
