import { builder } from './builder';

export const AccountType = builder.enumType('AccountType', {
  values: ['CHECKING', 'SAVINGS'] as const,
});

export const AccountStatus = builder.enumType('AccountStatus', {
  values: ['ACTIVE', 'FROZEN', 'CLOSED'] as const,
});

export const TransactionType = builder.enumType('TransactionType', {
  values: ['DEBIT', 'CREDIT'] as const,
});

export const CardNetwork = builder.enumType('CardNetwork', {
  values: ['VISA', 'MASTERCARD', 'AMEX'] as const,
});

export const CardType = builder.enumType('CardType', {
  values: ['DEBIT', 'CREDIT'] as const,
});

export const CardStatus = builder.enumType('CardStatus', {
  values: ['ACTIVE', 'BLOCKED', 'EXPIRED'] as const,
});

export const TransferStatus = builder.enumType('TransferStatus', {
  values: ['PENDING', 'COMPLETED', 'FAILED'] as const,
});
