import { builder } from './builder';
import {
  AccountStatus,
  AccountType,
  CardNetwork,
  CardStatus,
  CardType,
  TransactionType,
  TransferStatus,
} from './enums';

builder.prismaObject('Customer', {
  description: 'A bank customer.',
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    fullName: t.string({
      resolve: (customer) => `${customer.firstName} ${customer.lastName}`,
    }),
    email: t.exposeString('email'),
    phone: t.exposeString('phone', { nullable: true }),
    birthDate: t.expose('birthDate', { type: 'DateTime', nullable: true }),
    city: t.exposeString('city', { nullable: true }),
    country: t.exposeString('country', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    accounts: t.relation('accounts'),
    beneficiaries: t.relation('beneficiaries'),
  }),
});

builder.prismaObject('Account', {
  description: 'A bank account owned by a customer.',
  fields: (t) => ({
    id: t.exposeID('id'),
    iban: t.exposeString('iban'),
    label: t.exposeString('label'),
    type: t.expose('type', { type: AccountType }),
    status: t.expose('status', { type: AccountStatus }),
    currency: t.exposeString('currency'),
    balance: t.exposeFloat('balance'),
    openedAt: t.expose('openedAt', { type: 'DateTime' }),
    customer: t.relation('customer'),
    transactions: t.relation('transactions'),
    cards: t.relation('cards'),
    transfers: t.relation('transfers'),
  }),
});

builder.prismaObject('Transaction', {
  description: 'A single account movement (debit or credit).',
  fields: (t) => ({
    id: t.exposeID('id'),
    amount: t.exposeFloat('amount'),
    currency: t.exposeString('currency'),
    type: t.expose('type', { type: TransactionType }),
    category: t.exposeString('category', { nullable: true }),
    description: t.exposeString('description'),
    merchant: t.exposeString('merchant', { nullable: true }),
    date: t.expose('date', { type: 'DateTime' }),
    account: t.relation('account'),
  }),
});

builder.prismaObject('Card', {
  description: 'A payment card attached to an account.',
  fields: (t) => ({
    id: t.exposeID('id'),
    last4: t.exposeString('last4'),
    network: t.expose('network', { type: CardNetwork }),
    type: t.expose('type', { type: CardType }),
    status: t.expose('status', { type: CardStatus }),
    expiry: t.expose('expiry', { type: 'DateTime' }),
    account: t.relation('account'),
  }),
});

builder.prismaObject('Beneficiary', {
  description: 'A saved payee a customer can transfer money to.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    iban: t.exposeString('iban'),
    bankName: t.exposeString('bankName', { nullable: true }),
    customer: t.relation('customer'),
    transfers: t.relation('transfers'),
  }),
});

builder.prismaObject('Transfer', {
  description: 'A money transfer from an account to a beneficiary.',
  fields: (t) => ({
    id: t.exposeID('id'),
    amount: t.exposeFloat('amount'),
    currency: t.exposeString('currency'),
    reference: t.exposeString('reference', { nullable: true }),
    status: t.expose('status', { type: TransferStatus }),
    scheduledAt: t.expose('scheduledAt', { type: 'DateTime', nullable: true }),
    executedAt: t.expose('executedAt', { type: 'DateTime' }),
    fromAccount: t.relation('fromAccount'),
    beneficiary: t.relation('beneficiary'),
  }),
});
