/**
 * Miller List Navigation Feature Documentation
 * 
 * This module provides infinite, bidirectional navigation through Miller List views.
 * Users can click on any linked field to navigate to related entities, building
 * a navigation history that's displayed as columns in the Miller List interface.
 */

export * from './linkExtractor';
export * from './useMillerNavigation';

/**
 * # Miller List Navigation Feature
 * 
 * ## Overview
 * 
 * The Miller List navigation feature allows users to navigate between related entities
 * in a tree-like structure, where each level of navigation adds a new column to the
 * Miller List display. This creates an infinite navigation experience with no hardcoded
 * depth limits.
 * 
 * ## Key Components
 * 
 * ### 1. Link Extractor (`linkExtractor.ts`)
 * 
 * Extracts navigation configuration from widget definitions based on `linkTo` properties:
 * 
 * ```typescript
 * const widget: TableWidget = {
 *   type: 'table',
 *   id: 'accounts',
 *   data: { query: 'accounts' },
 *   columns: [
 *     {
 *       key: 'id',
 *       title: 'Account ID',
 *       linkTo: { concept: 'Account' } // Clickable link to Account concept
 *     },
 *     {
 *       key: 'customerId',
 *       title: 'Customer',
 *       linkTo: {
 *         concept: 'Customer',
 *         idField: 'customerId' // Extract ID from this field
 *       }
 *     }
 *   ]
 * };
 * 
 * const links = extractTableLinks(widget);
 * // links.get('customerId') => {
 * //   targetConcept: 'Customer',
 * //   idField: 'customerId',
 * //   sourceKey: 'customerId'
 * // }
 * ```
 * 
 * ### 2. Navigation Hook (`useMillerNavigation.ts`)
 * 
 * Provides utilities for handling navigation between entities:
 * 
 * ```typescript
 * const { navigateToEntity, navigateBack } = useMillerNavigation({
 *   isMillerView: true
 * });
 * 
 * // Navigate when user clicks a link
 * navigateToEntity('Customer', 'CUST-001');
 * // Updates URL from /miller/Account to /miller/Account/Customer/CUST-001
 * // Adds a new column to Miller List
 * 
 * // Go back one level
 * navigateBack();
 * ```
 * 
 * ### 3. Widget Updates
 * 
 * #### TableWidget (`views/widgets/TableWidget.tsx`)
 * 
 * - Extracts `linkTo` configurations from column definitions
 * - Renders clickable links when linkTo is present
 * - Uses `useMillerNavigation` hook for proper routing
 * - Automatically detects Miller view context and routes accordingly
 * 
 * #### DescriptionsWidget (`views/widgets/DescriptionsWidget.tsx`)
 * 
 * - Extracts `linkTo` configurations from item definitions
 * - Renders clickable descriptions fields
 * - Supports deeply nested ID field paths (e.g., 'customer.address.id')
 * - Works in both Miller and regular concept views
 * 
 * ### 4. Miller List View (`pages/MillerListView.tsx`)
 * 
 * - Manages the column structure for Miller List
 * - Implements `onClose` handlers for each column to enable back navigation
 * - Creates modified specs with injected IDs for detail views
 * - Builds infinite navigation without depth limits
 * 
 * ## Navigation Flow
 * 
 * ```
 * User clicks on Account ID in accounts table
 *         ↓
 * TableWidget renders link and calls navigateToEntity('Account', 'ACC-001')
 *         ↓
 * URL changes to /miller/Account/Account/ACC-001
 *         ↓
 * MillerListPage adds new column with account details
 *         ↓
 * User clicks on Customer field in account details
 *         ↓
 * DescriptionsWidget calls navigateToEntity('Customer', 'CUST-001')
 *         ↓
 * URL changes to /miller/Account/Account/ACC-001/Customer/CUST-001
 *         ↓
 * MillerListPage adds another column with customer details
 *         ↓ (infinite navigation continues...)
 * ```
 * 
 * ## Supported Navigation Patterns
 * 
 * ### Simple Links
 * Link to a concept by its ID field:
 * ```typescript
 * { key: 'id', linkTo: { concept: 'Account' } }
 * // Uses default 'id' field from the row
 * ```
 * 
 * ### Nested ID Fields
 * Extract ID from a nested property:
 * ```typescript
 * { key: 'customer', linkTo: { concept: 'Customer', idField: 'customer.id' } }
 * ```
 * 
 * ### Deep Nesting
 * Multiple levels of nesting are supported:
 * ```typescript
 * {
 *   key: 'organization',
 *   linkTo: { concept: 'Organization', idField: 'owner.company.organization.id' }
 * }
 * ```
 * 
 * ### Bidirectional Navigation
 * Navigate in any direction - forward and backward:
 * ```
 * Accounts → Customer → Orders → Account (different one) → ...
 * ```
 * 
 * ### Cycles
 * Navigate through the same entity multiple times:
 * ```
 * Account (ACC-001) → Customer → Account (ACC-002) → Customer (CUST-001) → Account (ACC-001)
 * ```
 * 
 * ## Features
 * 
 * ✅ **Infinite Navigation**: No hardcoded depth limits - navigate as deep as needed
 * ✅ **Bidirectional**: Can navigate forward and backward through relationships
 * ✅ **Back Navigation**: Close button on each column to navigate back one level
 * ✅ **Nested ID Fields**: Support for arbitrarily deep nested ID extraction
 * ✅ **Context-Aware**: Automatically detects Miller vs. concept view context
 * ✅ **Type-Safe**: Full TypeScript support with Zod validation
 * ✅ **Extensible**: Easy to add new concepts and navigation targets
 * ✅ **Performant**: Link extraction happens once during render
 * 
 * ## Testing
 * 
 * Comprehensive test suites included:
 * - `linkExtractor.test.ts`: Unit tests for link extraction and URL building
 * - `useMillerNavigation.test.ts`: Hook tests
 * - `miller-navigation.integration.test.ts`: End-to-end navigation scenarios
 * 
 * Tests cover:
 * - Link extraction from widgets
 * - Nested value extraction
 * - URL generation and building
 * - Infinite depth navigation
 * - Bidirectional navigation
 * - Navigation cycles
 * - Complex configurations
 * - Error handling and edge cases
 * 
 * ## Usage Example
 * 
 * ### Define a View with Navigation Links
 * 
 * ```typescript
 * const accountView: ViewSpec = {
 *   version: 1,
 *   id: 'account-list',
 *   concept: 'Account',
 *   title: 'Accounts',
 *   queries: {
 *     main: { query: 'query { accounts { id name customerId } }' }
 *   },
 *   widgets: [
 *     {
 *       type: 'table',
 *       id: 'accounts-table',
 *       data: { query: 'main' },
 *       columns: [
 *         {
 *           key: 'id',
 *           title: 'Account ID',
 *           linkTo: { concept: 'Account' }
 *         },
 *         {
 *           key: 'customerId',
 *           title: 'Customer',
 *           linkTo: { concept: 'Customer', idField: 'customerId' }
 *         },
 *         { key: 'name', title: 'Account Name' }
 *       ]
 *     }
 *   ]
 * };
 * ```
 * 
 * ### Navigate in the UI
 * 
 * 1. User visits `/miller/Account`
 * 2. Sees list of accounts with clickable IDs and customer names
 * 3. Clicks on "ACC-001" → navigates to `/miller/Account/Account/ACC-001`
 * 4. New column shows account details
 * 5. Clicks on customer name → navigates to `/miller/Account/Account/ACC-001/Customer/CUST-001`
 * 6. New column shows customer details
 * 7. Can continue navigating or click close button to go back
 * 
 * ## URL Structure
 * 
 * Miller List paths follow this pattern:
 * ```
 * /miller/<rootConcept>/<concept1>/<id1>/<concept2>/<id2>/...
 * 
 * Example:
 * /miller/Account
 * /miller/Account/Account/ACC-001
 * /miller/Account/Account/ACC-001/Customer/CUST-001
 * /miller/Account/Account/ACC-001/Customer/CUST-001/Order/ORD-001
 * ```
 * 
 * Each pair of segments represents a navigation level.
 */
