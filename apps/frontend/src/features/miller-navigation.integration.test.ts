/**
 * Integration tests for Miller List navigation functionality
 * Tests the complete flow of clicking links and navigating between entities
 */

import { describe, it, expect } from 'vitest';
import type { TableWidget, DescriptionsWidget, Column } from '@fluid/shared';
import {
  extractTableLinks,
  extractDescriptionLinks,
  getNestedValue,
  buildMillerNavigationUrl,
  buildConceptNavigationUrl,
  getNavigationId,
} from '../navigation/linkExtractor';

describe('Miller Navigation Integration - Complete Flow', () => {
  describe('Scenario: Account → Customer → Order Navigation', () => {
    const accountsTable: TableWidget = {
      type: 'table',
      id: 'accounts-table',
      data: { query: 'accounts' },
      columns: [
        { key: 'id', title: 'Account ID', linkTo: { concept: 'Account' } },
        { key: 'customerId', title: 'Customer', linkTo: { concept: 'Customer', idField: 'customerId' } },
        { key: 'name', title: 'Account Name' },
      ],
    };

    const customerDetails: DescriptionsWidget = {
      type: 'descriptions',
      id: 'customer-details',
      data: { query: 'customerById' },
      items: [
        { key: 'id', label: 'Customer ID', linkTo: { concept: 'Customer' } },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'accounts[0].id', label: 'Primary Account', linkTo: { concept: 'Account', idField: 'accounts[0].id' } },
      ],
    };

    const orderTable: TableWidget = {
      type: 'table',
      id: 'orders-table',
      data: { query: 'orders' },
      columns: [
        { key: 'id', title: 'Order ID', linkTo: { concept: 'Order' } },
        { key: 'accountId', title: 'Account', linkTo: { concept: 'Account', idField: 'accountId' } },
        { key: 'amount', title: 'Amount', format: 'currency' },
        { key: 'status', title: 'Status' },
      ],
    };

    it('should extract all navigation links from account table', () => {
      const links = extractTableLinks(accountsTable);
      expect(links.size).toBe(2); // id and customerId have linkTo
      expect(links.get('id')?.targetConcept).toBe('Account');
      expect(links.get('customerId')?.targetConcept).toBe('Customer');
    });

    it('should extract navigation links from customer details', () => {
      const links = extractDescriptionLinks(customerDetails);
      expect(links.size).toBe(2); // id and accounts[0].id have linkTo
      expect(links.get('id')?.targetConcept).toBe('Customer');
      expect(links.get('accounts[0].id')?.targetConcept).toBe('Account');
    });

    it('should extract navigation links from orders table', () => {
      const links = extractTableLinks(orderTable);
      expect(links.size).toBe(2); // id and accountId have linkTo
      expect(links.get('id')?.targetConcept).toBe('Order');
      expect(links.get('accountId')?.targetConcept).toBe('Account');
    });

    it('should navigate from accounts list to customer detail', () => {
      const row = { id: 'ACC-001', customerId: 'CUST-001', name: 'ACME Corp' };
      const customerLink = extractTableLinks(accountsTable).get('customerId');

      const customerId = getNavigationId(row, customerLink!.idField);
      const url = buildMillerNavigationUrl('/miller/Account', customerLink!.targetConcept, customerId!);

      expect(url).toBe('/miller/Account/Customer/CUST-001');
    });

    it('should navigate back from customer detail to account', () => {
      const customer = {
        id: 'CUST-001',
        name: 'John Doe',
        email: 'john@example.com',
        accounts: [{ id: 'ACC-001', name: 'Main Account' }],
      };

      const accountLink = extractDescriptionLinks(customerDetails).get('accounts[0].id');
      const accountId = getNavigationId(customer, accountLink!.idField);
      const url = buildMillerNavigationUrl('/miller/Account/Customer/CUST-001', accountLink!.targetConcept, accountId!);

      expect(url).toBe('/miller/Account/Customer/CUST-001/Account/ACC-001');
    });

    it('should handle deeply nested navigation', () => {
      // Start at accounts list
      let currentPath = '/miller/Account';

      // Navigate to customer
      currentPath = buildMillerNavigationUrl(currentPath, 'Customer', 'CUST-001');
      expect(currentPath).toBe('/miller/Account/Customer/CUST-001');

      // Navigate to related account
      currentPath = buildMillerNavigationUrl(currentPath, 'Account', 'ACC-002');
      expect(currentPath).toBe('/miller/Account/Customer/CUST-001/Account/ACC-002');

      // Navigate to orders
      currentPath = buildMillerNavigationUrl(currentPath, 'Order', 'ORD-001');
      expect(currentPath).toBe('/miller/Account/Customer/CUST-001/Account/ACC-002/Order/ORD-001');

      // Can continue indefinitely
      currentPath = buildMillerNavigationUrl(currentPath, 'Account', 'ACC-003');
      expect(currentPath).toMatch(/^\/miller\/Account\/.*\/Account\/ACC-003$/);
    });
  });

  describe('Scenario: Infinite Navigation Depth', () => {
    it('should support navigation to arbitrary depth (100 levels)', () => {
      let path = '/miller/Account';
      const concepts = ['Account', 'Customer', 'Order', 'Product'];

      for (let i = 0; i < 100; i++) {
        const targetConcept = concepts[i % concepts.length];
        const itemId = `${targetConcept.substring(0, 3)}-${String(i + 1).padStart(5, '0')}`;
        path = buildMillerNavigationUrl(path, targetConcept, itemId);
      }

      // Should have built a very long path without any errors
      expect(path).toContain('/miller/Account');
      expect(path).toContain('/Product/Pro-00100');
    });

    it('should support navigation cycles', () => {
      let path = '/miller/Account';

      // Navigate: Account → Customer → Account → Customer → Account
      path = buildMillerNavigationUrl(path, 'Customer', 'CUST-001');
      expect(path).toContain('Customer/CUST-001');

      path = buildMillerNavigationUrl(path, 'Account', 'ACC-002');
      expect(path).toContain('/Account/ACC-002');

      path = buildMillerNavigationUrl(path, 'Customer', 'CUST-002');
      expect(path).toContain('/Customer/CUST-002');

      path = buildMillerNavigationUrl(path, 'Account', 'ACC-003');
      expect(path).toContain('/Account/ACC-003');

      // Each navigation is valid
      expect(path).toMatch(/^\/miller\/Account\/.+$/);
    });
  });

  describe('Scenario: Bidirectional Navigation', () => {
    it('should allow navigation in both directions between concepts', () => {
      // Forward: Account → Customer
      let path = '/miller/Account';
      path = buildMillerNavigationUrl(path, 'Customer', 'CUST-001');
      expect(path).toBe('/miller/Account/Customer/CUST-001');

      // Backward: Customer → Account
      path = buildMillerNavigationUrl(path, 'Account', 'ACC-001');
      expect(path).toBe('/miller/Account/Customer/CUST-001/Account/ACC-001');

      // Forward again: Account → Order
      path = buildMillerNavigationUrl(path, 'Order', 'ORD-001');
      expect(path).toBe('/miller/Account/Customer/CUST-001/Account/ACC-001/Order/ORD-001');

      // Backward: Order → Customer
      path = buildMillerNavigationUrl(path, 'Customer', 'CUST-001');
      expect(path).toBe('/miller/Account/Customer/CUST-001/Account/ACC-001/Order/ORD-001/Customer/CUST-001');
    });

    it('should allow returning to previously visited items', () => {
      // Navigate: Account → Customer → Order → Account (same account as before)
      let path = '/miller/Account';
      path = buildMillerNavigationUrl(path, 'Customer', 'CUST-001');
      path = buildMillerNavigationUrl(path, 'Order', 'ORD-001');
      path = buildMillerNavigationUrl(path, 'Account', 'ACC-001');

      // The final path includes all previous navigation
      expect(path).toContain('ACC-001');
      expect(path).toContain('CUST-001');
      expect(path).toContain('ORD-001');

      // We can see the full trail of navigation
      const parts = path.split('/').filter(Boolean);
      expect(parts.length).toBeGreaterThan(2);
    });
  });

  describe('Scenario: Complex Widget Configurations', () => {
    it('should handle multiple linkTo columns in same table', () => {
      const complexTable: TableWidget = {
        type: 'table',
        id: 'complex-table',
        data: { query: 'complexData' },
        columns: [
          { key: 'id', linkTo: { concept: 'Item' } },
          { key: 'parentId', linkTo: { concept: 'Item', idField: 'parentId' } },
          { key: 'categoryId', linkTo: { concept: 'Category', idField: 'categoryId' } },
          { key: 'ownerId', linkTo: { concept: 'User', idField: 'ownerId' } },
          { key: 'name', title: 'Name' }, // No linkTo
        ],
      };

      const links = extractTableLinks(complexTable);
      expect(links.size).toBe(4);

      // Can extract IDs from nested data
      const row = {
        id: 'ITEM-001',
        parentId: 'ITEM-002',
        categoryId: 'CAT-001',
        ownerId: 'USR-001',
        name: 'Test Item',
      };

      const itemId = getNavigationId(row, links.get('id')!.idField);
      const parentId = getNavigationId(row, links.get('parentId')!.idField);
      const categoryId = getNavigationId(row, links.get('categoryId')!.idField);
      const ownerId = getNavigationId(row, links.get('ownerId')!.idField);

      expect(itemId).toBe('ITEM-001');
      expect(parentId).toBe('ITEM-002');
      expect(categoryId).toBe('CAT-001');
      expect(ownerId).toBe('USR-001');
    });

    it('should handle deeply nested linkTo idField paths', () => {
      const table: TableWidget = {
        type: 'table',
        id: 'nested-table',
        data: { query: 'data' },
        columns: [
          {
            key: 'owner.organization.id',
            linkTo: {
              concept: 'Organization',
              idField: 'owner.organization.id',
            },
          },
        ],
      };

      const row = {
        id: 'ITEM-001',
        owner: {
          id: 'USER-001',
          organization: {
            id: 'ORG-001',
            name: 'ACME Corp',
          },
        },
      };

      const links = extractTableLinks(table);
      const orgId = getNavigationId(row, links.get('owner.organization.id')!.idField);

      expect(orgId).toBe('ORG-001');

      const url = buildMillerNavigationUrl(
        '/miller/Item',
        'Organization',
        orgId!,
      );
      expect(url).toBe('/miller/Item/Organization/ORG-001');
    });
  });

  describe('Scenario: Error Handling and Edge Cases', () => {
    it('should gracefully handle missing navigation IDs', () => {
      const table: TableWidget = {
        type: 'table',
        id: 'test',
        data: { query: 'test' },
        columns: [
          { key: 'id', linkTo: { concept: 'Item' } },
          { key: 'relatedId', linkTo: { concept: 'Related', idField: 'relatedId' } },
        ],
      };

      // Row with missing relatedId
      const row = { id: 'ITEM-001', relatedId: null };

      const links = extractTableLinks(table);
      const id = getNavigationId(row, links.get('id')!.idField);
      const relatedId = getNavigationId(row, links.get('relatedId')!.idField);

      expect(id).toBe('ITEM-001');
      expect(relatedId).toBeUndefined();
    });

    it('should handle empty or whitespace IDs', () => {
      const row1 = { id: '', name: 'Test' };
      const row2 = { id: null, name: 'Test' };
      const row3 = { id: undefined, name: 'Test' };

      expect(getNavigationId(row1, 'id')).toBeUndefined();
      expect(getNavigationId(row2, 'id')).toBeUndefined();
      expect(getNavigationId(row3, 'id')).toBeUndefined();
    });

    it('should handle numeric IDs by converting to strings', () => {
      const row = { id: 12345, relatedId: 67890.5 };

      const id = getNavigationId(row, 'id');
      const relatedId = getNavigationId(row, 'relatedId');

      expect(id).toBe('12345');
      expect(relatedId).toBe('67890.5');
    });
  });
});
