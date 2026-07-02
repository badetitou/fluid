/**
 * Mock data for testing the infinite navigation feature
 * This demonstrates how to set up data for the Miller list-like navigation
 */

import type { ViewSpec } from '@fluid/shared';

/**
 * Mock view for displaying a list of accounts with navigation links
 */
export const MOCK_ACCOUNTS_LIST_VIEW: ViewSpec = {
  version: 1,
  id: 'accounts-list-view',
  concept: 'Account',
  title: 'All Accounts',
  description: 'List of all customer accounts with links to navigate',
  queries: {
    accounts: {
      query: 'query { accounts { id name customerId customer { id name } balance } }',
    },
  },
  widgets: [
    {
      type: 'table',
      id: 'accounts-table',
      title: 'Accounts',
      span: 24,
      data: { query: 'accounts', path: 'accounts' },
      columns: [
        {
          key: 'id',
          title: 'Account ID',
          width: 120,
          // This enables navigation to the account detail page
          linkTo: {
            concept: 'Account',
            idField: 'id',
          },
        },
        {
          key: 'name',
          title: 'Account Name',
          width: 200,
        },
        {
          key: 'customer.name',
          title: 'Customer',
          width: 200,
          // This enables navigation to the customer detail page
          linkTo: {
            concept: 'Customer',
            idField: 'customer.id',
          },
        },
        {
          key: 'balance',
          title: 'Balance',
          format: 'currency',
          currency: 'EUR',
          width: 120,
        },
      ],
      pageSize: 10,
    },
  ],
};

/**
 * Mock view for displaying details of a single account
 * This view will be shown when navigating to /concept/Account/item/:id
 */
export const MOCK_ACCOUNT_DETAIL_VIEW: ViewSpec = {
  version: 1,
  id: 'account-detail-view',
  concept: 'Account',
  title: 'Account Details',
  description: 'Detailed view of a single account',
  queries: {
    // This will be automatically populated with the item ID when viewing an item
    accountById: {
      query: `
        query($id: ID!) {
          accountById(id: $id) {
            id
            name
            customerId
            customer {
              id
              name
              email
            }
            balance
            createdAt
            orders {
              id
              orderNumber
              amount
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      type: 'descriptions',
      id: 'account-info',
      title: 'Account Information',
      span: 12,
      data: { query: 'accountById', path: 'accountById' },
      items: [
        {
          label: 'Account ID',
          key: 'id',
        },
        {
          label: 'Account Name',
          key: 'name',
        },
        {
          label: 'Balance',
          key: 'balance',
          format: 'currency',
          currency: 'EUR',
        },
        {
          label: 'Created',
          key: 'createdAt',
          format: 'datetime',
        },
        {
          label: 'Customer',
          key: 'customer.name',
          // This enables navigation to the customer detail page
          linkTo: {
            concept: 'Customer',
            idField: 'customer.id',
          },
        },
      ],
      columns: 2,
    },
    {
      type: 'statistic',
      id: 'account-balance-stat',
      title: 'Account Balance',
      span: 12,
      data: { query: 'accountById', path: 'accountById' },
      value: { op: 'first', field: 'balance' },
      format: 'currency',
      currency: 'EUR',
      prefix: '€ ',
    },
    {
      type: 'table',
      id: 'account-orders-table',
      title: 'Related Orders',
      span: 24,
      data: { query: 'accountById', path: 'accountById.orders' },
      columns: [
        {
          key: 'id',
          title: 'Order ID',
          width: 120,
          // This enables navigation to the order detail page
          linkTo: {
            concept: 'Order',
            idField: 'id',
          },
        },
        {
          key: 'orderNumber',
          title: 'Order Number',
          width: 150,
        },
        {
          key: 'amount',
          title: 'Amount',
          format: 'currency',
          currency: 'EUR',
          width: 120,
        },
      ],
    },
  ],
};

/**
 * Mock view for displaying a list of customers
 */
export const MOCK_CUSTOMERS_LIST_VIEW: ViewSpec = {
  version: 1,
  id: 'customers-list-view',
  concept: 'Customer',
  title: 'All Customers',
  queries: {
    customers: {
      query: 'query { customers { id name email accountCount } }',
    },
  },
  widgets: [
    {
      type: 'table',
      id: 'customers-table',
      title: 'Customers',
      span: 24,
      data: { query: 'customers', path: 'customers' },
      columns: [
        {
          key: 'id',
          title: 'Customer ID',
          width: 120,
          // Navigate to customer detail
          linkTo: {
            concept: 'Customer',
            idField: 'id',
          },
        },
        {
          key: 'name',
          title: 'Name',
          width: 200,
        },
        {
          key: 'email',
          title: 'Email',
          width: 250,
        },
        {
          key: 'accountCount',
          title: 'Accounts',
          width: 100,
        },
      ],
    },
  ],
};

/**
 * Mock view for displaying details of a single customer
 */
export const MOCK_CUSTOMER_DETAIL_VIEW: ViewSpec = {
  version: 1,
  id: 'customer-detail-view',
  concept: 'Customer',
  title: 'Customer Details',
  queries: {
    customerById: {
      query: `
        query($id: ID!) {
          customerById(id: $id) {
            id
            name
            email
            phone
            accounts {
              id
              name
              balance
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      type: 'descriptions',
      id: 'customer-info',
      title: 'Customer Information',
      span: 12,
      data: { query: 'customerById', path: 'customerById' },
      items: [
        { label: 'ID', key: 'id' },
        { label: 'Name', key: 'name' },
        { label: 'Email', key: 'email' },
        { label: 'Phone', key: 'phone' },
      ],
    },
    {
      type: 'table',
      id: 'customer-accounts-table',
      title: 'Related Accounts',
      span: 24,
      data: { query: 'customerById', path: 'customerById.accounts' },
      columns: [
        {
          key: 'id',
          title: 'Account ID',
          width: 120,
          // Navigate back to account detail (bidirectional!)
          linkTo: {
            concept: 'Account',
            idField: 'id',
          },
        },
        {
          key: 'name',
          title: 'Account Name',
          width: 200,
        },
        {
          key: 'balance',
          title: 'Balance',
          format: 'currency',
          currency: 'EUR',
          width: 120,
        },
      ],
    },
  ],
};

/**
 * Mock view for displaying a list of orders
 */
export const MOCK_ORDERS_LIST_VIEW: ViewSpec = {
  version: 1,
  id: 'orders-list-view',
  concept: 'Order',
  title: 'All Orders',
  queries: {
    orders: {
      query:
        'query { orders { id orderNumber accountId account { id name } amount status } }',
    },
  },
  widgets: [
    {
      type: 'table',
      id: 'orders-table',
      title: 'Orders',
      span: 24,
      data: { query: 'orders', path: 'orders' },
      columns: [
        {
          key: 'id',
          title: 'Order ID',
          width: 120,
          linkTo: { concept: 'Order', idField: 'id' },
        },
        {
          key: 'orderNumber',
          title: 'Order #',
          width: 120,
        },
        {
          key: 'account.name',
          title: 'Account',
          width: 200,
          linkTo: { concept: 'Account', idField: 'account.id' },
        },
        {
          key: 'amount',
          title: 'Amount',
          format: 'currency',
          currency: 'EUR',
          width: 120,
        },
        {
          key: 'status',
          title: 'Status',
          width: 100,
        },
      ],
    },
  ],
};

/**
 * Mock view for displaying details of a single order
 */
export const MOCK_ORDER_DETAIL_VIEW: ViewSpec = {
  version: 1,
  id: 'order-detail-view',
  concept: 'Order',
  title: 'Order Details',
  queries: {
    orderById: {
      query: `
        query($id: ID!) {
          orderById(id: $id) {
            id
            orderNumber
            accountId
            account {
              id
              name
              customerId
              customer { id name }
            }
            amount
            status
            createdAt
            items {
              id
              productId
              product { id name price }
              quantity
            }
          }
        }
      `,
    },
  },
  widgets: [
    {
      type: 'descriptions',
      id: 'order-info',
      title: 'Order Information',
      span: 12,
      data: { query: 'orderById', path: 'orderById' },
      items: [
        { label: 'Order ID', key: 'id' },
        { label: 'Order #', key: 'orderNumber' },
        {
          label: 'Account',
          key: 'account.name',
          linkTo: { concept: 'Account', idField: 'account.id' },
        },
        {
          label: 'Customer',
          key: 'account.customer.name',
          linkTo: { concept: 'Customer', idField: 'account.customer.id' },
        },
        { label: 'Amount', key: 'amount', format: 'currency' },
        { label: 'Status', key: 'status' },
        { label: 'Created', key: 'createdAt', format: 'datetime' },
      ],
    },
    {
      type: 'table',
      id: 'order-items-table',
      title: 'Order Items',
      span: 24,
      data: { query: 'orderById', path: 'orderById.items' },
      columns: [
        {
          key: 'id',
          title: 'Item ID',
          width: 120,
        },
        {
          key: 'product.name',
          title: 'Product',
          width: 200,
          linkTo: { concept: 'Product', idField: 'product.id' },
        },
        {
          key: 'product.price',
          title: 'Unit Price',
          format: 'currency',
          currency: 'EUR',
          width: 120,
        },
        {
          key: 'quantity',
          title: 'Quantity',
          width: 100,
        },
      ],
    },
  ],
};

/**
 * Export all mock views as a collection
 * These can be used to populate the view store for testing
 */
export const MOCK_VIEWS_BY_CONCEPT: Record<string, ViewSpec[]> = {
  Account: [MOCK_ACCOUNTS_LIST_VIEW, MOCK_ACCOUNT_DETAIL_VIEW],
  Customer: [MOCK_CUSTOMERS_LIST_VIEW, MOCK_CUSTOMER_DETAIL_VIEW],
  Order: [MOCK_ORDERS_LIST_VIEW, MOCK_ORDER_DETAIL_VIEW],
};

/**
 * Navigation flow example:
 *
 * Start: /concept/Account
 *   ↓ View: MOCK_ACCOUNTS_LIST_VIEW
 *   ↓ Click Account ID (linkTo Account)
 *
 * /concept/Account/item/ACC-001
 *   ↓ View: MOCK_ACCOUNT_DETAIL_VIEW
 *   ↓ Click Customer (linkTo Customer)
 *
 * /concept/Customer/item/CUST-001
 *   ↓ View: MOCK_CUSTOMER_DETAIL_VIEW
 *   ↓ Click Account ID (linkTo Account)
 *
 * /concept/Account/item/ACC-002
 *   ↓ Back to Account Detail
 *   ↓ Click Order ID (linkTo Order)
 *
 * /concept/Order/item/ORD-001
 *   ↓ View: MOCK_ORDER_DETAIL_VIEW
 *   ↓ Click Account (linkTo Account)
 *
 * /concept/Account/item/ACC-001
 *   ↓ Back to Account Detail
 *   ↓ ... Continue infinitely!
 */
