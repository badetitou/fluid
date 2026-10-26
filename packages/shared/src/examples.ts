import type { ViewSpec } from './view-spec';
import { classMethodsExample } from './widgets/accordion';
import { blueprintExample } from './widgets/blueprint';
import { boxesExample } from './widgets/boxes';
import { butterflyExample } from './widgets/butterfly';
import { classDiagramExample } from './widgets/classDiagram';
import { methodSourceExample } from './widgets/code';
import { characterEpisodesMatrixExample, classDependencyMatrixExample } from './widgets/matrixExample';
import { characterEpisodesNetworkExample } from './widgets/network';
import { todoEditExample, todoListExample } from './widgets/form';
import { wall3dExample } from './widgets/model3dExample';
import { overviewPyramidExample } from './widgets/pyramid';
import { postBodyExample } from './widgets/richtext';
import { characterFlowSankeyExample } from './widgets/sankey';
import { countryScatterExample } from './widgets/scatter';
import { continentTreeExample } from './widgets/tree';

// -----------------------------------------------------------------------------
// Curated example views
// -----------------------------------------------------------------------------
// Hand-written dashboards that ship with Fluid so a few concepts look great out
// of the box (and to serve as concrete references for the view spec / the LLM).
// The frontend also auto-generates a fallback "overview" for every concept.
// -----------------------------------------------------------------------------

const accountsOverview: ViewSpec = {
  version: 1,
  id: 'builtin:account-overview',
  concept: 'Account',
  title: 'Accounts overview',
  description: 'Balances, distribution by type and status, and the full account list.',
  queries: {
    accounts: {
      query: /* GraphQL */ `
        query FluidAccountsOverview($take: Int) {
          accounts(take: $take) {
            id
            iban
            label
            type
            status
            currency
            balance
            openedAt
            customer {
              fullName
            }
          }
        }
      `,
      variables: { take: 200 },
    },
  },
  widgets: [
    {
      id: 'count',
      type: 'statistic',
      title: 'Accounts',
      span: 6,
      data: { query: 'accounts', path: 'accounts' },
      value: { op: 'count' },
    },
    {
      id: 'total-balance',
      type: 'statistic',
      title: 'Total balance',
      span: 6,
      data: { query: 'accounts', path: 'accounts' },
      value: { op: 'sum', field: 'balance' },
      format: 'currency',
      currency: 'EUR',
    },
    {
      id: 'avg-balance',
      type: 'statistic',
      title: 'Average balance',
      span: 6,
      data: { query: 'accounts', path: 'accounts' },
      value: { op: 'avg', field: 'balance' },
      format: 'currency',
      currency: 'EUR',
    },
    {
      id: 'max-balance',
      type: 'statistic',
      title: 'Largest balance',
      span: 6,
      data: { query: 'accounts', path: 'accounts' },
      value: { op: 'max', field: 'balance' },
      format: 'currency',
      currency: 'EUR',
    },
    {
      id: 'by-type',
      type: 'pie',
      title: 'By type',
      span: 8,
      height: 280,
      data: { query: 'accounts', path: 'accounts', transform: { groupBy: 'type' } },
      angleField: 'count',
      colorField: 'type',
    },
    {
      id: 'by-status',
      type: 'pie',
      title: 'By status',
      span: 8,
      height: 280,
      data: { query: 'accounts', path: 'accounts', transform: { groupBy: 'status' } },
      angleField: 'count',
      colorField: 'status',
    },
    {
      id: 'balance-by-type',
      type: 'bar',
      title: 'Total balance by type',
      span: 8,
      height: 280,
      data: {
        query: 'accounts',
        path: 'accounts',
        transform: { groupBy: 'type', aggregate: { field: 'balance' } },
      },
      xField: 'type',
      yField: 'sum',
    },
    {
      id: 'list',
      type: 'table',
      title: 'Accounts',
      span: 24,
      data: {
        query: 'accounts',
        path: 'accounts',
        transform: { sort: { by: 'balance', dir: 'desc' } },
      },
      columns: [
        { key: 'label', title: 'Label' },
        { key: 'iban', title: 'IBAN' },
        { key: 'type', title: 'Type', format: 'tag' },
        { key: 'status', title: 'Status', format: 'tag' },
        { key: 'customer.fullName', title: 'Owner' },
        { key: 'balance', title: 'Balance', format: 'currency', currency: 'EUR' },
        { key: 'openedAt', title: 'Opened', format: 'date' },
      ],
      pageSize: 10,
    },
  ],
};

const transactionAnalytics: ViewSpec = {
  version: 1,
  id: 'builtin:transaction-analytics',
  concept: 'Transaction',
  title: 'Transaction analytics',
  description: 'Volume and amounts broken down by type and category, plus recent activity.',
  queries: {
    transactions: {
      query: /* GraphQL */ `
        query FluidTransactionAnalytics($take: Int) {
          transactions(take: $take) {
            id
            amount
            currency
            type
            category
            description
            merchant
            date
            account {
              iban
            }
          }
        }
      `,
      variables: { take: 200 },
    },
  },
  widgets: [
    {
      id: 'count',
      type: 'statistic',
      title: 'Transactions',
      span: 8,
      data: { query: 'transactions', path: 'transactions' },
      value: { op: 'count' },
    },
    {
      id: 'total-amount',
      type: 'statistic',
      title: 'Total amount',
      span: 8,
      data: { query: 'transactions', path: 'transactions' },
      value: { op: 'sum', field: 'amount' },
      format: 'currency',
      currency: 'EUR',
    },
    {
      id: 'avg-amount',
      type: 'statistic',
      title: 'Average amount',
      span: 8,
      data: { query: 'transactions', path: 'transactions' },
      value: { op: 'avg', field: 'amount' },
      format: 'currency',
      currency: 'EUR',
    },
    {
      id: 'amount-by-type',
      type: 'bar',
      title: 'Amount by type',
      span: 12,
      height: 280,
      data: {
        query: 'transactions',
        path: 'transactions',
        transform: { groupBy: 'type', aggregate: { field: 'amount' } },
      },
      xField: 'type',
      yField: 'sum',
    },
    {
      id: 'by-category',
      type: 'pie',
      title: 'Volume by category',
      span: 12,
      height: 280,
      data: {
        query: 'transactions',
        path: 'transactions',
        transform: { groupBy: 'category', sort: { by: 'count', dir: 'desc' }, limit: 8 },
      },
      angleField: 'count',
      colorField: 'category',
    },
    {
      id: 'recent',
      type: 'table',
      title: 'Recent transactions',
      span: 24,
      data: {
        query: 'transactions',
        path: 'transactions',
        transform: { sort: { by: 'date', dir: 'desc' }, limit: 25 },
      },
      columns: [
        { key: 'date', title: 'Date', format: 'datetime' },
        { key: 'description', title: 'Description' },
        { key: 'merchant', title: 'Merchant' },
        { key: 'category', title: 'Category', format: 'tag' },
        { key: 'type', title: 'Type', format: 'tag' },
        { key: 'account.iban', title: 'Account' },
        { key: 'amount', title: 'Amount', format: 'currency', currency: 'EUR' },
      ],
      pageSize: 10,
    },
  ],
};

/** Curated views, grouped by the concept they target. */
export const EXAMPLE_VIEWS: Record<string, ViewSpec[]> = {
  Account: [accountsOverview],
  Transaction: [transactionAnalytics],
  Continent: [continentTreeExample],
  Post: [postBodyExample],
  Todo: [todoListExample, todoEditExample],
  Country: [countryScatterExample],
  Method: [methodSourceExample, butterflyExample],
  Class: [classMethodsExample, classDiagramExample, boxesExample, blueprintExample, classDependencyMatrixExample],
  Character: [characterEpisodesNetworkExample, characterFlowSankeyExample, characterEpisodesMatrixExample],
  IfcWallStandardCase: [wall3dExample],
  Package: [overviewPyramidExample],
};

/** All curated views as a flat list. */
export const ALL_EXAMPLE_VIEWS: ViewSpec[] = Object.values(EXAMPLE_VIEWS).flat();
