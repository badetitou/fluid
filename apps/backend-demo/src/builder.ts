import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import { DateTimeResolver } from 'graphql-scalars';
import type PrismaTypes from './generated/pothos-types';
import { getDatamodel } from './generated/pothos-types';
import { prisma } from './db';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
  };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
    onUnusedQuery: process.env.NODE_ENV === 'production' ? null : 'warn',
  },
});

builder.addScalarType('DateTime', DateTimeResolver);

builder.queryType({
  description: 'Explore the demo bank: customers, accounts, transactions, cards, beneficiaries, transfers.',
});
