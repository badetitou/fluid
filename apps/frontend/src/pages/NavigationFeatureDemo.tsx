/**
 * Demo component showing the infinite navigation feature in action
 * This can be used to test the linkTo functionality without needing a full GraphQL backend
 */

import { Link } from 'react-router-dom';
import { Card, Table, Row, Col, Flex, Typography, Tag, Alert } from 'antd';
import {
  MOCK_GRAPHQL_DATA,
  getMockAccountById,
  getMockCustomerById,
  getMockOrderById,
} from '../graphql/mockGraphqlData';

export function NavigationFeatureDemo() {
  return (
    <Flex vertical gap={24} style={{ padding: 24 }}>
      <Alert
        type="info"
        showIcon
        message="Infinite Navigation Demo"
        description={
          <>
            This demo shows how the infinite navigation feature works. Click on any ID or linked
            value to navigate to its detail page. This demonstrates the{' '}
            <strong>Miller list-style navigation</strong>.
          </>
        }
      />

      {/* Accounts List Demo */}
      <Card title="1. Accounts List" extra={<Tag>LIST VIEW</Tag>}>
        <Typography.Paragraph>
          Click on an Account ID to navigate to its detail page. The{' '}
          <code>linkTo: {'{ concept: "Account" }'}</code> configuration on the ID column enables
          this.
        </Typography.Paragraph>
        <Table
          size="small"
          columns={[
            {
              title: 'Account ID',
              dataIndex: 'id',
              render: (id: string) => (
                <Link to={`/concept/Account/item/${id}`}>
                  <strong>{id}</strong>
                </Link>
              ),
            },
            {
              title: 'Name',
              dataIndex: 'name',
            },
            {
              title: 'Customer',
              render: (_, record: any) => (
                <Link to={`/concept/Customer/item/${record.customer.id}`}>
                  {record.customer.name}
                </Link>
              ),
            },
            {
              title: 'Balance',
              dataIndex: 'balance',
              render: (balance: number) => `€ ${balance.toLocaleString()}`,
            },
          ]}
          dataSource={MOCK_GRAPHQL_DATA.accounts}
          pagination={false}
          rowKey="id"
        />
      </Card>

      {/* Account Detail Demo */}
      <Card title="2. Account Detail (example: ACC-001)" extra={<Tag>ITEM VIEW</Tag>}>
        <Flex vertical gap={16}>
          <Typography.Paragraph>
            When you navigate to <code>/concept/Account/item/ACC-001</code>, the ItemPage injects
            the ID into the query and loads the details. Click on links to navigate further.
          </Typography.Paragraph>
          <AccountDetailDemo accountId="ACC-001" />
        </Flex>
      </Card>

      {/* Customer Detail Demo */}
      <Card title="3. Customer Detail (example: CUST-001)" extra={<Tag>ITEM VIEW</Tag>}>
        <Flex vertical gap={16}>
          <Typography.Paragraph>
            When you navigate to <code>/concept/Customer/item/CUST-001</code>, you see the
            customer's details and related accounts. Click on an account ID to navigate back (
            <strong>bidirectional navigation!</strong>).
          </Typography.Paragraph>
          <CustomerDetailDemo customerId="CUST-001" />
        </Flex>
      </Card>

      {/* Order Detail Demo */}
      <Card title="4. Order Detail (example: ORD-001)" extra={<Tag>ITEM VIEW</Tag>}>
        <Flex vertical gap={16}>
          <Typography.Paragraph>
            When you navigate to <code>/concept/Order/item/ORD-001</code>, you see the order
            details with links to the account, customer, and products.
          </Typography.Paragraph>
          <OrderDetailDemo orderId="ORD-001" />
        </Flex>
      </Card>

      {/* Navigation Flow Diagram */}
      <Card title="Navigation Flow (Infinite)" extra={<Tag color="green">DEMO</Tag>}>
        <Flex vertical gap={16}>
          <NavigationFlowDiagram />
        </Flex>
      </Card>
    </Flex>
  );
}

/**
 * Account Detail Demo Component
 */
function AccountDetailDemo({ accountId }: { accountId: string }) {
  const account = getMockAccountById(accountId);

  if (!account) return <Typography.Text type="danger">Account not found</Typography.Text>;

  return (
    <Flex vertical gap={12}>
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small">
            <Flex vertical gap={8}>
              <Flex justify="space-between">
                <Typography.Text strong>Account ID:</Typography.Text>
                <Typography.Text code>{account.id}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Name:</Typography.Text>
                <Typography.Text>{account.name}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Balance:</Typography.Text>
                <Typography.Text>€ {account.balance.toLocaleString()}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Customer:</Typography.Text>
                <Link to={`/concept/Customer/item/${account.customer.id}`}>
                  <strong>{account.customer.name}</strong>
                </Link>
              </Flex>
            </Flex>
          </Card>
        </Col>
      </Row>

      {account.orders.length > 0 && (
        <Flex vertical gap={8}>
          <Typography.Text strong>Related Orders:</Typography.Text>
          <Table
            size="small"
            columns={[
              {
                title: 'Order ID',
                dataIndex: 'id',
                render: (id: string) => (
                  <Link to={`/concept/Order/item/${id}`}>
                    <strong>{id}</strong>
                  </Link>
                ),
              },
              {
                title: 'Order #',
                dataIndex: 'orderNumber',
              },
              {
                title: 'Amount',
                dataIndex: 'amount',
                render: (amount: number) => `€ ${amount.toLocaleString()}`,
              },
            ]}
            dataSource={account.orders}
            pagination={false}
            rowKey="id"
          />
        </Flex>
      )}
    </Flex>
  );
}

/**
 * Customer Detail Demo Component
 */
function CustomerDetailDemo({ customerId }: { customerId: string }) {
  const customer = getMockCustomerById(customerId);

  if (!customer) return <Typography.Text type="danger">Customer not found</Typography.Text>;

  return (
    <Flex vertical gap={12}>
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small">
            <Flex vertical gap={8}>
              <Flex justify="space-between">
                <Typography.Text strong>Customer ID:</Typography.Text>
                <Typography.Text code>{customer.id}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Name:</Typography.Text>
                <Typography.Text>{customer.name}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Email:</Typography.Text>
                <Typography.Text>{customer.email}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Phone:</Typography.Text>
                <Typography.Text>{customer.phone}</Typography.Text>
              </Flex>
            </Flex>
          </Card>
        </Col>
      </Row>

      {customer.accounts.length > 0 && (
        <Flex vertical gap={8}>
          <Typography.Text strong>Related Accounts (click to navigate back!):</Typography.Text>
          <Table
            size="small"
            columns={[
              {
                title: 'Account ID',
                dataIndex: 'id',
                render: (id: string) => (
                  <Link to={`/concept/Account/item/${id}`}>
                    <strong>{id}</strong>
                  </Link>
                ),
              },
              {
                title: 'Name',
                dataIndex: 'name',
              },
              {
                title: 'Balance',
                dataIndex: 'balance',
                render: (balance: number) => `€ ${balance.toLocaleString()}`,
              },
            ]}
            dataSource={customer.accounts}
            pagination={false}
            rowKey="id"
          />
        </Flex>
      )}
    </Flex>
  );
}

/**
 * Order Detail Demo Component
 */
function OrderDetailDemo({ orderId }: { orderId: string }) {
  const order = getMockOrderById(orderId);

  if (!order) return <Typography.Text type="danger">Order not found</Typography.Text>;

  return (
    <Flex vertical gap={12}>
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small">
            <Flex vertical gap={8}>
              <Flex justify="space-between">
                <Typography.Text strong>Order ID:</Typography.Text>
                <Typography.Text code>{order.id}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Order #:</Typography.Text>
                <Typography.Text>{order.orderNumber}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Amount:</Typography.Text>
                <Typography.Text>€ {order.amount.toLocaleString()}</Typography.Text>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Status:</Typography.Text>
                <Tag color={order.status === 'completed' ? 'green' : 'orange'}>
                  {order.status}
                </Tag>
              </Flex>
              <Flex justify="space-between">
                <Typography.Text strong>Account:</Typography.Text>
                <Link to={`/concept/Account/item/${order.account.id}`}>
                  <strong>{order.account.name}</strong>
                </Link>
              </Flex>
            </Flex>
          </Card>
        </Col>
      </Row>

      {order.items.length > 0 && (
        <Flex vertical gap={8}>
          <Typography.Text strong>Order Items:</Typography.Text>
          <Table
            size="small"
            columns={[
              {
                title: 'Product',
                render: (_, record: any) => (
                  <Typography.Text>{record.product.name}</Typography.Text>
                ),
              },
              {
                title: 'Unit Price',
                render: (_, record: any) => `€ ${record.product.price.toLocaleString()}`,
              },
              {
                title: 'Quantity',
                dataIndex: 'quantity',
              },
            ]}
            dataSource={order.items}
            pagination={false}
            rowKey="id"
          />
        </Flex>
      )}
    </Flex>
  );
}

/**
 * Navigation Flow Diagram
 */
function NavigationFlowDiagram() {
  return (
    <Flex vertical gap={16}>
      <div style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
        <Typography.Paragraph style={{ fontSize: 12 }}>
          {`Start: /concept/Account
   ↓ See: Accounts List
   ├─ Table with Account IDs (linkTo: Account)
   └─ Click "ACC-001" 
   
   ↓

/concept/Account/item/ACC-001
   ├─ Description with Customer (linkTo: Customer)
   ├─ Table of Orders (linkTo: Order)
   └─ Click "John Doe" (customer link)
   
   ↓

/concept/Customer/item/CUST-001
   ├─ Customer details
   ├─ Table of Related Accounts (linkTo: Account)
   └─ Click "ACC-003" 
   
   ↓

/concept/Account/item/ACC-003
   ├─ Account details for ACC-003
   └─ No orders, but could click back to customer
   
   ↓

/concept/Customer/item/CUST-001
   ├─ Back to customer
   └─ Click "ACC-001" (BIDIRECTIONAL!)
   
   ↓

/concept/Account/item/ACC-001
   ├─ Back to ACC-001
   └─ Click "ORD-001" (order link)
   
   ↓

/concept/Order/item/ORD-001
   ├─ Order details
   └─ Click "Account" or "Customer" links
   
   ↓ ... INFINITE NAVIGATION! ✅`}
        </Typography.Paragraph>
      </div>

      <Alert
        type="success"
        showIcon
        message="No limit on navigation depth"
        description={"You can continue navigating infinitely between objects. There's no \"hardcoded\" depth limit."}
      />
    </Flex>
  );
}
