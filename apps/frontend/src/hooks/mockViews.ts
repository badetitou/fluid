/**
 * Mock views for testing the infinite navigation feature
 */

import type { ViewSpec, Widget } from '@fluid/shared';

// Mock Account Views
export const MOCK_ACCOUNTS_LIST_VIEW: ViewSpec = {
  version: 1,
  id: 'accounts-list',
  concept: 'Account',
  title: 'Accounts List',
  queries: {
    list: {
      query: 'query { accounts { id name customerId } }',
    },
  },
  widgets: [
    {
      type: 'table',
      id: 'accounts-table',
      title: 'Accounts',
      data: {
        query: 'list',
        path: 'accounts',
      },
      columns: [
        {
          key: 'id',
          title: 'ID',
          linkTo: { concept: 'Account' },
        },
        {
          key: 'name',
          title: 'Name',
        },
        {
          key: 'customerId',
          title: 'Customer',
          linkTo: { concept: 'Customer', idField: 'customerId' },
        },
      ],
    } as Widget,
  ],
};

export const MOCK_ACCOUNT_DETAIL_VIEW: ViewSpec = {
  version: 1,
  id: 'account-detail',
  concept: 'Account',
  title: 'Account Details',
  queries: {
    byId: {
      query: 'query($id: ID!) { accountById(id: $id) { id name customerId customer { id name } } }',
    },
  },
  widgets: [
    {
      type: 'descriptions',
      id: 'account-descriptions',
      title: 'Details',
      data: {
        query: 'byId',
        path: 'accountById',
      },
      items: [
        { label: 'ID', key: 'id' },
        { label: 'Name', key: 'name' },
        {
          label: 'Customer',
          key: 'customer.id',
          linkTo: { concept: 'Customer', idField: 'customer.id' },
        },
      ],
    } as Widget,
  ],
};

// Mock Customer Views
export const MOCK_CUSTOMERS_LIST_VIEW: ViewSpec = {
  version: 1,
  id: 'customers-list',
  concept: 'Customer',
  title: 'Customers List',
  queries: {
    list: {
      query: 'query { customers { id name email } }',
    },
  },
  widgets: [
    {
      type: 'table',
      id: 'customers-table',
      title: 'Customers',
      data: {
        query: 'list',
        path: 'customers',
      },
      columns: [
        {
          key: 'id',
          title: 'ID',
          linkTo: { concept: 'Customer' },
        },
        {
          key: 'name',
          title: 'Name',
        },
        {
          key: 'email',
          title: 'Email',
        },
      ],
    } as Widget,
  ],
};

export const MOCK_CUSTOMER_DETAIL_VIEW: ViewSpec = {
  version: 1,
  id: 'customer-detail',
  concept: 'Customer',
  title: 'Customer Details',
  queries: {
    byId: {
      query: 'query($id: ID!) { customerById(id: $id) { id name email phone orders { id orderId } } }',
    },
  },
  widgets: [
    {
      type: 'descriptions',
      id: 'customer-descriptions',
      title: 'Details',
      data: {
        query: 'byId',
        path: 'customerById',
      },
      items: [
        { label: 'ID', key: 'id' },
        { label: 'Name', key: 'name' },
        { label: 'Email', key: 'email' },
        { label: 'Phone', key: 'phone' },
      ],
    } as Widget,
    {
      type: 'table',
      id: 'orders-table',
      title: 'Orders',
      data: {
        query: 'byId',
        path: 'customerById.orders',
      },
      columns: [
        {
          key: 'id',
          title: 'Order ID',
          linkTo: { concept: 'Order', idField: 'id' },
        },
      ],
    } as Widget,
  ],
};

// Mock Order Views
export const MOCK_ORDERS_LIST_VIEW: ViewSpec = {
  version: 1,
  id: 'orders-list',
  concept: 'Order',
  title: 'Orders List',
  queries: {
    list: {
      query: 'query { orders { id orderId customerId total } }',
    },
  },
  widgets: [
    {
      type: 'table',
      id: 'orders-table',
      title: 'Orders',
      data: {
        query: 'list',
        path: 'orders',
      },
      columns: [
        {
          key: 'id',
          title: 'ID',
          linkTo: { concept: 'Order' },
        },
        {
          key: 'orderId',
          title: 'Order ID',
        },
        {
          key: 'customerId',
          title: 'Customer',
          linkTo: { concept: 'Customer', idField: 'customerId' },
        },
        {
          key: 'total',
          title: 'Total',
        },
      ],
    } as Widget,
  ],
};

export const MOCK_ORDER_DETAIL_VIEW: ViewSpec = {
  version: 1,
  id: 'order-detail',
  concept: 'Order',
  title: 'Order Details',
  queries: {
    byId: {
      query: 'query($id: ID!) { orderById(id: $id) { id orderId customerId total customer { id name } items { id product quantity } } }',
    },
  },
  widgets: [
    {
      type: 'descriptions',
      id: 'order-descriptions',
      title: 'Details',
      data: {
        query: 'byId',
        path: 'orderById',
      },
      items: [
        { label: 'ID', key: 'id' },
        { label: 'Order ID', key: 'orderId' },
        {
          label: 'Customer',
          key: 'customer.id',
          linkTo: { concept: 'Customer', idField: 'customer.id' },
        },
        { label: 'Total', key: 'total' },
      ],
    } as Widget,
    {
      type: 'table',
      id: 'order-items-table',
      title: 'Items',
      data: {
        query: 'byId',
        path: 'orderById.items',
      },
      columns: [
        { key: 'id', title: 'Item ID' },
        { key: 'product', title: 'Product' },
        { key: 'quantity', title: 'Quantity' },
      ],
    } as Widget,
  ],
};
