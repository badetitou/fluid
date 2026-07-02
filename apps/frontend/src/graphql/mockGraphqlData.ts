/**
 * Mock GraphQL responses for testing infinite navigation
 * These simulate what a real GraphQL API would return
 */

/**
 * Mock data structure
 */
export const MOCK_GRAPHQL_DATA = {
  accounts: [
    {
      id: 'ACC-001',
      name: 'ACME Corporation',
      customerId: 'CUST-001',
      customer: {
        id: 'CUST-001',
        name: 'John Doe',
      },
      balance: 15000.5,
      createdAt: '2024-01-15T10:30:00Z',
      orders: [
        {
          id: 'ORD-001',
          orderNumber: 'ORD-2024-001',
          amount: 5000,
        },
        {
          id: 'ORD-002',
          orderNumber: 'ORD-2024-002',
          amount: 3500,
        },
      ],
    },
    {
      id: 'ACC-002',
      name: 'TechStart Inc',
      customerId: 'CUST-002',
      customer: {
        id: 'CUST-002',
        name: 'Jane Smith',
      },
      balance: 25000,
      createdAt: '2024-02-20T14:45:00Z',
      orders: [
        {
          id: 'ORD-003',
          orderNumber: 'ORD-2024-003',
          amount: 8000,
        },
      ],
    },
    {
      id: 'ACC-003',
      name: 'Global Industries',
      customerId: 'CUST-001',
      customer: {
        id: 'CUST-001',
        name: 'John Doe',
      },
      balance: 42000,
      createdAt: '2024-03-10T09:15:00Z',
      orders: [],
    },
  ],

  customers: [
    {
      id: 'CUST-001',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1-555-0101',
      accountCount: 2,
      accounts: [
        {
          id: 'ACC-001',
          name: 'ACME Corporation',
          balance: 15000.5,
        },
        {
          id: 'ACC-003',
          name: 'Global Industries',
          balance: 42000,
        },
      ],
    },
    {
      id: 'CUST-002',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+1-555-0102',
      accountCount: 1,
      accounts: [
        {
          id: 'ACC-002',
          name: 'TechStart Inc',
          balance: 25000,
        },
      ],
    },
    {
      id: 'CUST-003',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      phone: '+1-555-0103',
      accountCount: 0,
      accounts: [],
    },
  ],

  orders: [
    {
      id: 'ORD-001',
      orderNumber: 'ORD-2024-001',
      accountId: 'ACC-001',
      account: {
        id: 'ACC-001',
        name: 'ACME Corporation',
      },
      amount: 5000,
      status: 'completed',
      createdAt: '2024-01-20T11:00:00Z',
      items: [
        {
          id: 'ITEM-001',
          productId: 'PROD-001',
          product: {
            id: 'PROD-001',
            name: 'Widget A',
            price: 1000,
          },
          quantity: 5,
        },
      ],
    },
    {
      id: 'ORD-002',
      orderNumber: 'ORD-2024-002',
      accountId: 'ACC-001',
      account: {
        id: 'ACC-001',
        name: 'ACME Corporation',
        customerId: 'CUST-001',
        customer: {
          id: 'CUST-001',
          name: 'John Doe',
        },
      },
      amount: 3500,
      status: 'pending',
      createdAt: '2024-02-01T14:30:00Z',
      items: [
        {
          id: 'ITEM-002',
          productId: 'PROD-002',
          product: {
            id: 'PROD-002',
            name: 'Widget B',
            price: 700,
          },
          quantity: 5,
        },
      ],
    },
    {
      id: 'ORD-003',
      orderNumber: 'ORD-2024-003',
      accountId: 'ACC-002',
      account: {
        id: 'ACC-002',
        name: 'TechStart Inc',
        customerId: 'CUST-002',
        customer: {
          id: 'CUST-002',
          name: 'Jane Smith',
        },
      },
      amount: 8000,
      status: 'completed',
      createdAt: '2024-02-15T10:15:00Z',
      items: [
        {
          id: 'ITEM-003',
          productId: 'PROD-003',
          product: {
            id: 'PROD-003',
            name: 'Premium Widget',
            price: 2000,
          },
          quantity: 4,
        },
      ],
    },
  ],

  products: [
    {
      id: 'PROD-001',
      name: 'Widget A',
      price: 1000,
      supplierId: 'SUP-001',
      supplier: {
        id: 'SUP-001',
        name: 'Supplier One',
      },
    },
    {
      id: 'PROD-002',
      name: 'Widget B',
      price: 700,
      supplierId: 'SUP-002',
      supplier: {
        id: 'SUP-002',
        name: 'Supplier Two',
      },
    },
    {
      id: 'PROD-003',
      name: 'Premium Widget',
      price: 2000,
      supplierId: 'SUP-001',
      supplier: {
        id: 'SUP-001',
        name: 'Supplier One',
      },
    },
  ],
};

/**
 * Mock function to get an account by ID
 */
export function getMockAccountById(id: string) {
  return MOCK_GRAPHQL_DATA.accounts.find((a) => a.id === id);
}

/**
 * Mock function to get a customer by ID
 */
export function getMockCustomerById(id: string) {
  return MOCK_GRAPHQL_DATA.customers.find((c) => c.id === id);
}

/**
 * Mock function to get an order by ID
 */
export function getMockOrderById(id: string) {
  return MOCK_GRAPHQL_DATA.orders.find((o) => o.id === id);
}

/**
 * Mock function to get a product by ID
 */
export function getMockProductById(id: string) {
  return MOCK_GRAPHQL_DATA.products.find((p) => p.id === id);
}

/**
 * Mock responses for each query
 */
export const MOCK_QUERY_RESPONSES: Record<string, Record<string, any>> = {
  // Account queries
  accounts: { accounts: MOCK_GRAPHQL_DATA.accounts },
  accountById: (id: string) => ({
    accountById: getMockAccountById(id),
  }),

  // Customer queries
  customers: { customers: MOCK_GRAPHQL_DATA.customers },
  customerById: (id: string) => ({
    customerById: getMockCustomerById(id),
  }),

  // Order queries
  orders: { orders: MOCK_GRAPHQL_DATA.orders },
  orderById: (id: string) => ({
    orderById: getMockOrderById(id),
  }),

  // Product queries
  products: { products: MOCK_GRAPHQL_DATA.products },
  productById: (id: string) => ({
    productById: getMockProductById(id),
  }),
};

/**
 * Navigation flow using mock data:
 *
 * 1. View: ACCOUNTS LIST
 *    - Query: { accounts { id name customer.id customer.name balance } }
 *    - Data:
 *      - ACC-001: ACME, Customer CUST-001 (John Doe), €15,000
 *      - ACC-002: TechStart, Customer CUST-002 (Jane Smith), €25,000
 *    - Links: Click ACC-001 → navigate to /concept/Account/item/ACC-001
 *
 * 2. View: ACCOUNT DETAIL (ACC-001)
 *    - Query: accountById(id: "ACC-001") { account details + orders }
 *    - Data:
 *      - Account: ACC-001 ACME, Balance €15,000, Customer: CUST-001 John Doe
 *      - Related Orders: ORD-001, ORD-002
 *    - Links:
 *      - Click "John Doe" → navigate to /concept/Customer/item/CUST-001
 *      - Click ORD-001 → navigate to /concept/Order/item/ORD-001
 *
 * 3. View: CUSTOMER DETAIL (CUST-001)
 *    - Query: customerById(id: "CUST-001") { customer details + accounts }
 *    - Data:
 *      - Customer: CUST-001 John Doe, john@example.com
 *      - Related Accounts: ACC-001, ACC-003
 *    - Links: Click ACC-003 → navigate to /concept/Account/item/ACC-003
 *
 * 4. View: ACCOUNT DETAIL (ACC-003)
 *    - Query: accountById(id: "ACC-003") { account details + orders }
 *    - Data:
 *      - Account: ACC-003 Global Industries, Balance €42,000
 *      - No orders
 *    - Links: Click back or navigate to other items
 *
 * This demonstrates INFINITE NAVIGATION! ✅
 */
