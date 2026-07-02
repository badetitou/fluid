import { builder } from './builder';
import { prisma } from './db';

const clamp = (take: number | null | undefined, fallback = 50) =>
  Math.min(Math.max(take ?? fallback, 1), 200);

builder.queryFields((t) => ({
  customers: t.prismaField({
    type: ['Customer'],
    description: 'List customers.',
    args: {
      take: t.arg.int({ description: 'Max rows to return (default 50, max 200).' }),
      skip: t.arg.int({ description: 'Rows to skip (default 0).' }),
    },
    resolve: (query, _root, args) =>
      prisma.customer.findMany({
        ...query,
        take: clamp(args.take),
        skip: args.skip ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
  }),
  customer: t.prismaField({
    type: 'Customer',
    nullable: true,
    description: 'Fetch a single customer by id.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      prisma.customer.findUnique({ ...query, where: { id: String(args.id) } }),
  }),

  accounts: t.prismaField({
    type: ['Account'],
    description: 'List accounts.',
    args: {
      take: t.arg.int({ description: 'Max rows to return (default 50, max 200).' }),
      skip: t.arg.int({ description: 'Rows to skip (default 0).' }),
    },
    resolve: (query, _root, args) =>
      prisma.account.findMany({
        ...query,
        take: clamp(args.take),
        skip: args.skip ?? 0,
        orderBy: { openedAt: 'desc' },
      }),
  }),
  account: t.prismaField({
    type: 'Account',
    nullable: true,
    description: 'Fetch a single account by id.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      prisma.account.findUnique({ ...query, where: { id: String(args.id) } }),
  }),

  transactions: t.prismaField({
    type: ['Transaction'],
    description: 'List transactions.',
    args: {
      take: t.arg.int({ description: 'Max rows to return (default 50, max 200).' }),
      skip: t.arg.int({ description: 'Rows to skip (default 0).' }),
    },
    resolve: (query, _root, args) =>
      prisma.transaction.findMany({
        ...query,
        take: clamp(args.take),
        skip: args.skip ?? 0,
        orderBy: { date: 'desc' },
      }),
  }),
  transaction: t.prismaField({
    type: 'Transaction',
    nullable: true,
    description: 'Fetch a single transaction by id.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      prisma.transaction.findUnique({ ...query, where: { id: String(args.id) } }),
  }),

  cards: t.prismaField({
    type: ['Card'],
    description: 'List payment cards.',
    args: {
      take: t.arg.int({ description: 'Max rows to return (default 50, max 200).' }),
      skip: t.arg.int({ description: 'Rows to skip (default 0).' }),
    },
    resolve: (query, _root, args) =>
      prisma.card.findMany({
        ...query,
        take: clamp(args.take),
        skip: args.skip ?? 0,
      }),
  }),
  card: t.prismaField({
    type: 'Card',
    nullable: true,
    description: 'Fetch a single card by id.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      prisma.card.findUnique({ ...query, where: { id: String(args.id) } }),
  }),

  beneficiaries: t.prismaField({
    type: ['Beneficiary'],
    description: 'List beneficiaries.',
    args: {
      take: t.arg.int({ description: 'Max rows to return (default 50, max 200).' }),
      skip: t.arg.int({ description: 'Rows to skip (default 0).' }),
    },
    resolve: (query, _root, args) =>
      prisma.beneficiary.findMany({
        ...query,
        take: clamp(args.take),
        skip: args.skip ?? 0,
        orderBy: { name: 'asc' },
      }),
  }),
  beneficiary: t.prismaField({
    type: 'Beneficiary',
    nullable: true,
    description: 'Fetch a single beneficiary by id.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      prisma.beneficiary.findUnique({ ...query, where: { id: String(args.id) } }),
  }),

  transfers: t.prismaField({
    type: ['Transfer'],
    description: 'List transfers.',
    args: {
      take: t.arg.int({ description: 'Max rows to return (default 50, max 200).' }),
      skip: t.arg.int({ description: 'Rows to skip (default 0).' }),
    },
    resolve: (query, _root, args) =>
      prisma.transfer.findMany({
        ...query,
        take: clamp(args.take),
        skip: args.skip ?? 0,
        orderBy: { executedAt: 'desc' },
      }),
  }),
  transfer: t.prismaField({
    type: 'Transfer',
    nullable: true,
    description: 'Fetch a single transfer by id.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      prisma.transfer.findUnique({ ...query, where: { id: String(args.id) } }),
  }),
}));
