/**
 * Tests for the link extraction and navigation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  extractTableLinks,
  extractDescriptionLinks,
  getNestedValue,
  buildMillerNavigationUrl,
  buildConceptNavigationUrl,
  getNavigationId,
  linkTargetConcept,
  type NavigationLink,
} from './linkExtractor';
import type { TableWidget, DescriptionsWidget } from '@fluid/shared';

describe('linkExtractor - Table Widget Link Extraction', () => {
  it('should extract linkTo configuration from table columns', () => {
    const widget: TableWidget = {
      type: 'table',
      id: 'test-table',
      data: { query: 'accounts' },
      columns: [
        {
          key: 'id',
          title: 'Account ID',
          linkTo: { concept: 'Account' },
        },
        {
          key: 'customerId',
          title: 'Customer',
          linkTo: { concept: 'Customer', idField: 'customerId' },
        },
        {
          key: 'name',
          title: 'Name',
        },
      ],
    };

    const links = extractTableLinks(widget);

    expect(links.size).toBe(2);
    expect(links.get('id')).toEqual({
      targetConcept: 'Account',
      idField: 'id',
      sourceKey: 'id',
    });
    expect(links.get('customerId')).toEqual({
      targetConcept: 'Customer',
      idField: 'customerId',
      sourceKey: 'customerId',
    });
  });

  it('should use default idField of "id" when not specified', () => {
    const widget: TableWidget = {
      type: 'table',
      id: 'test-table',
      data: { query: 'accounts' },
      columns: [
        {
          key: 'accountId',
          title: 'Account',
          linkTo: { concept: 'Account' },
        },
      ],
    };

    const links = extractTableLinks(widget);
    expect(links.get('accountId')?.idField).toBe('id');
  });

  it('should return empty map when no columns have linkTo', () => {
    const widget: TableWidget = {
      type: 'table',
      id: 'test-table',
      data: { query: 'accounts' },
      columns: [
        { key: 'id', title: 'ID' },
        { key: 'name', title: 'Name' },
      ],
    };

    const links = extractTableLinks(widget);
    expect(links.size).toBe(0);
  });

  it('should handle widgets with no columns defined', () => {
    const widget: TableWidget = {
      type: 'table',
      id: 'test-table',
      data: { query: 'accounts' },
    };

    const links = extractTableLinks(widget);
    expect(links.size).toBe(0);
  });
});

describe('linkExtractor - Description Widget Link Extraction', () => {
  it('should extract linkTo configuration from description items', () => {
    const widget: DescriptionsWidget = {
      type: 'descriptions',
      id: 'test-desc',
      data: { query: 'account' },
      items: [
        {
          key: 'id',
          label: 'Account ID',
          linkTo: { concept: 'Account' },
        },
        {
          key: 'customer.id',
          label: 'Customer',
          linkTo: { concept: 'Customer', idField: 'customer.id' },
        },
        {
          key: 'name',
          label: 'Name',
        },
      ],
    };

    const links = extractDescriptionLinks(widget);

    expect(links.size).toBe(2);
    expect(links.get('id')).toEqual({
      targetConcept: 'Account',
      idField: 'id',
      sourceKey: 'id',
    });
    expect(links.get('customer.id')).toEqual({
      targetConcept: 'Customer',
      idField: 'customer.id',
      sourceKey: 'customer.id',
    });
  });

  it('should return empty map when no items have linkTo', () => {
    const widget: DescriptionsWidget = {
      type: 'descriptions',
      id: 'test-desc',
      data: { query: 'account' },
      items: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
      ],
    };

    const links = extractDescriptionLinks(widget);
    expect(links.size).toBe(0);
  });
});

describe('linkExtractor - Nested Value Extraction', () => {
  it('should extract simple top-level fields', () => {
    const obj = { id: 'ACC-001', name: 'ACME' };
    expect(getNestedValue(obj, 'id')).toBe('ACC-001');
    expect(getNestedValue(obj, 'name')).toBe('ACME');
  });

  it('should extract nested fields with dot notation', () => {
    const obj = {
      id: 'ACC-001',
      customer: { id: 'CUST-001', name: 'John' },
    };

    expect(getNestedValue(obj, 'customer.id')).toBe('CUST-001');
    expect(getNestedValue(obj, 'customer.name')).toBe('John');
  });

  it('should extract deeply nested fields', () => {
    const obj = {
      order: {
        account: {
          customer: { id: 'CUST-001' },
        },
      },
    };

    expect(getNestedValue(obj, 'order.account.customer.id')).toBe('CUST-001');
  });

  it('should return undefined for missing paths', () => {
    const obj = { id: 'ACC-001' };

    expect(getNestedValue(obj, 'missing')).toBeUndefined();
    expect(getNestedValue(obj, 'customer.id')).toBeUndefined();
    expect(getNestedValue(obj, 'customer.account.id')).toBeUndefined();
  });

  it('should return undefined for null or undefined intermediate values', () => {
    const obj = { customer: null };
    expect(getNestedValue(obj, 'customer.id')).toBeUndefined();
  });
});

describe('linkExtractor - Navigation URL Building', () => {
  describe('Miller List URLs', () => {
    it('should append to existing miller path', () => {
      const url = buildMillerNavigationUrl(
        '/d/Account/Account@ACC-001',
        'Customer',
        'CUST-001',
      );

      expect(url).toBe('/d/Account/Account@ACC-001/Customer@CUST-001');
    });

    it('should handle miller root path', () => {
      const url = buildMillerNavigationUrl(
        '/d/Account',
        'Customer',
        'CUST-001',
      );

      expect(url).toBe('/d/Account/Customer@CUST-001');
    });

    it('should start new miller view if not in miller context', () => {
      const url = buildMillerNavigationUrl(
        '/concept/Account/item/ACC-001',
        'Customer',
        'CUST-001',
      );

      expect(url).toBe('/d/Customer@CUST-001');
    });
  });

  describe('Concept Item URLs', () => {
    it('should build correct concept item URLs', () => {
      expect(buildConceptNavigationUrl('Account', 'ACC-001')).toBe(
        '/concept/Account/item/ACC-001',
      );
      expect(buildConceptNavigationUrl('Customer', 'CUST-001')).toBe(
        '/concept/Customer/item/CUST-001',
      );
    });

    it('should handle any ID format', () => {
      const urls = [
        buildConceptNavigationUrl('Account', 'ACC-001'),
        buildConceptNavigationUrl('Account', '123'),
        buildConceptNavigationUrl('Account', 'uuid-12345'),
      ];

      urls.forEach((url) => {
        expect(url).toMatch(/^\/concept\/\w+\/item\/.+$/);
      });
    });
  });
});

describe('linkExtractor - Navigation ID Extraction', () => {
  it('should extract valid navigation IDs', () => {
    const row = { id: 'ACC-001', name: 'ACME' };
    expect(getNavigationId(row, 'id')).toBe('ACC-001');
  });

  it('should extract nested ID values', () => {
    const row = {
      id: 'ORD-001',
      customer: { id: 'CUST-001' },
    };

    expect(getNavigationId(row, 'customer.id')).toBe('CUST-001');
  });

  it('should return undefined for missing ID', () => {
    const row = { id: 'ACC-001' };
    expect(getNavigationId(row, 'customer.id')).toBeUndefined();
  });

  it('should return undefined for null or empty ID', () => {
    expect(getNavigationId({ id: null }, 'id')).toBeUndefined();
    expect(getNavigationId({ id: undefined }, 'id')).toBeUndefined();
    expect(getNavigationId({ id: '' }, 'id')).toBeUndefined();
  });

  it('should convert non-string IDs to strings', () => {
    expect(getNavigationId({ id: 123 }, 'id')).toBe('123');
    expect(getNavigationId({ id: 456.789 }, 'id')).toBe('456.789');
  });
});

describe('linkExtractor - Integration Tests', () => {
  it('should extract links and build navigation URLs', () => {
    // Define a table widget with navigation links
    const widget: TableWidget = {
      type: 'table',
      id: 'accounts-table',
      data: { query: 'accounts' },
      columns: [
        { key: 'id', title: 'ID', linkTo: { concept: 'Account' } },
        { key: 'customerId', title: 'Customer', linkTo: { concept: 'Customer', idField: 'customerId' } },
      ],
    };

    const links = extractTableLinks(widget);
    const row = { id: 'ACC-001', customerId: 'CUST-001', name: 'ACME' };

    // Extract ID for first link
    const accountId = getNavigationId(row, links.get('id')!.idField);
    const accountUrl = buildConceptNavigationUrl('Account', accountId!);
    expect(accountUrl).toBe('/concept/Account/item/ACC-001');

    // Extract ID for second link
    const customerId = getNavigationId(row, links.get('customerId')!.idField);
    const customerUrl = buildConceptNavigationUrl('Customer', customerId!);
    expect(customerUrl).toBe('/concept/Customer/item/CUST-001');
  });

  it('should support infinite navigation between entities', () => {
    const navigationPath: Array<{ concept: string; id: string }> = [];
    const concepts = ['Account', 'Customer', 'Order', 'Product'];

    // Simulate navigating through 100 levels
    for (let i = 0; i < 100; i++) {
      const concept = concepts[i % concepts.length];
      const id = `${concept.substring(0, 3)}-${String(i + 1).padStart(5, '0')}`;
      navigationPath.push({ concept, id });
    }

    // Verify path length (no depth limit)
    expect(navigationPath).toHaveLength(100);

    // Verify URLs can be built for any level
    navigationPath.forEach(({ concept, id }) => {
      const url = buildConceptNavigationUrl(concept, id);
      expect(url).toMatch(/^\/concept\/\w+\/item\/.+$/);
    });
  });

  it('should support bidirectional navigation', () => {
    // Table with links to Customer
    const accountWidget: TableWidget = {
      type: 'table',
      id: 'accounts',
      data: { query: 'accounts' },
      columns: [
        { key: 'id', linkTo: { concept: 'Account' } },
        { key: 'customerId', linkTo: { concept: 'Customer', idField: 'customerId' } },
      ],
    };

    // Description showing related Accounts
    const customerWidget: DescriptionsWidget = {
      type: 'descriptions',
      id: 'customer',
      data: { query: 'customer' },
      items: [
        { key: 'id', label: 'ID', linkTo: { concept: 'Customer' } },
        { key: 'accounts[0].id', label: 'Related Account', linkTo: { concept: 'Account', idField: 'accounts[0].id' } },
      ],
    };

    const accountLinks = extractTableLinks(accountWidget);
    const customerLinks = extractDescriptionLinks(customerWidget);

    // Can navigate: Account → Customer
    expect(accountLinks.get('customerId')?.targetConcept).toBe('Customer');

    // Can navigate: Customer → Account
    expect(customerLinks.get('accounts[0].id')?.targetConcept).toBe('Account');
  });
});

describe('linkExtractor - Concrete link target', () => {
  const openable = (c: string) => ['Class', 'Package'].includes(c);

  it('opens the concrete type of an item linked through an interface', () => {
    const row = { __typename: 'Class', id: '1', container: { __typename: 'Package', id: '2' } };
    expect(linkTargetConcept(row, { concept: 'MooseEntity' }, openable)).toBe('Class');
    expect(linkTargetConcept(row, { concept: 'MooseEntity', idField: 'container.id' }, openable)).toBe('Package');
  });

  it('keeps the declared concept when the concrete type is unknown or cannot be opened', () => {
    expect(linkTargetConcept({ id: '1' }, { concept: 'MooseEntity' }, openable)).toBe('MooseEntity');
    expect(linkTargetConcept({ __typename: 'Method', id: '1' }, { concept: 'MooseEntity' }, openable)).toBe('MooseEntity');
  });
});

