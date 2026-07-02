import {
  AccountStatus,
  AccountType,
  CardNetwork,
  CardStatus,
  CardType,
  PrismaClient,
  TransactionType,
  TransferStatus,
  type Prisma,
} from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const CUSTOMERS = 20;
const NOW = new Date();

const DEBIT_CATEGORIES = [
  'Groceries',
  'Restaurants',
  'Transport',
  'Utilities',
  'Entertainment',
  'Health',
  'Shopping',
  'Travel',
  'Subscriptions',
];

const BANKS = [
  'BNP Paribas',
  'Société Générale',
  'Crédit Agricole',
  'La Banque Postale',
  'Revolut',
  'N26',
  'ING',
];

const round2 = (n: number) => Math.round(n * 100) / 100;

async function reset() {
  await prisma.transfer.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.card.deleteMany();
  await prisma.beneficiary.deleteMany();
  await prisma.account.deleteMany();
  await prisma.customer.deleteMany();
}

function buildTransactions(accountId: string, type: AccountType, openedAt: Date) {
  const rows: Prisma.TransactionCreateManyInput[] = [];

  const opening =
    type === AccountType.SAVINGS
      ? faker.number.int({ min: 3000, max: 15000 })
      : faker.number.int({ min: 500, max: 3000 });
  rows.push({
    accountId,
    amount: opening,
    type: TransactionType.CREDIT,
    category: 'Opening deposit',
    description: 'Account opening deposit',
    date: openedAt,
  });

  if (type === AccountType.CHECKING) {
    for (let m = 6; m >= 1; m--) {
      const date = faker.date.recent({ days: m * 30, refDate: NOW });
      rows.push({
        accountId,
        amount: round2(faker.number.float({ min: 2200, max: 4800, fractionDigits: 2 })),
        type: TransactionType.CREDIT,
        category: 'Salary',
        description: 'Monthly salary',
        merchant: faker.company.name(),
        date,
      });
    }
  }

  // Savings accounts mostly grow (deposits + interest); checking accounts spend more.
  const creditChance = type === AccountType.SAVINGS ? 55 : 12;
  const count = faker.number.int({ min: 30, max: 90 });
  for (let i = 0; i < count; i++) {
    const isCredit = faker.number.int({ min: 0, max: 100 }) < creditChance;
    const date = faker.date.between({ from: openedAt, to: NOW });
    if (isCredit) {
      const isSavings = type === AccountType.SAVINGS;
      rows.push({
        accountId,
        amount: round2(
          faker.number.float({ min: isSavings ? 50 : 10, max: isSavings ? 900 : 600, fractionDigits: 2 }),
        ),
        type: TransactionType.CREDIT,
        category: isSavings
          ? faker.helpers.arrayElement(['Deposit', 'Interest', 'Transfer in'])
          : 'Refund',
        description: faker.helpers.arrayElement(['Refund', 'Reimbursement', 'Cashback', 'Deposit']),
        merchant: faker.company.name(),
        date,
      });
    } else {
      const category = faker.helpers.arrayElement(DEBIT_CATEGORIES);
      const maxDebit = type === AccountType.SAVINGS ? 250 : 450;
      rows.push({
        accountId,
        amount: round2(-faker.number.float({ min: 3, max: maxDebit, fractionDigits: 2 })),
        type: TransactionType.DEBIT,
        category,
        description: `${category} - ${faker.commerce.productName()}`,
        merchant: faker.company.name(),
        date,
      });
    }
  }

  // Guarantee a realistic, non-negative balance: if debits outweigh credits,
  // add a dated correction credit so the ledger stays consistent with the balance.
  const total = rows.reduce((sum, tx) => sum + tx.amount, 0);
  if (total < 100) {
    rows.push({
      accountId,
      amount: round2(-total + faker.number.float({ min: 200, max: 2500, fractionDigits: 2 })),
      type: TransactionType.CREDIT,
      category: 'Adjustment',
      description: 'Balance adjustment',
      date: faker.date.between({ from: openedAt, to: NOW }),
    });
  }

  return rows;
}

function buildCards(accountId: string) {
  const cardCount = faker.number.int({ min: 0, max: 2 });
  const rows: Prisma.CardCreateManyInput[] = [];
  for (let i = 0; i < cardCount; i++) {
    rows.push({
      accountId,
      last4: faker.string.numeric(4),
      network: faker.helpers.arrayElement([
        CardNetwork.VISA,
        CardNetwork.MASTERCARD,
        CardNetwork.AMEX,
      ]),
      type: faker.helpers.arrayElement([CardType.DEBIT, CardType.CREDIT]),
      status: faker.helpers.weightedArrayElement([
        { value: CardStatus.ACTIVE, weight: 8 },
        { value: CardStatus.BLOCKED, weight: 1 },
        { value: CardStatus.EXPIRED, weight: 1 },
      ]),
      expiry: faker.date.future({ years: 4 }),
    });
  }
  return rows;
}

async function main() {
  console.log('🧹  Resetting database...');
  await reset();

  console.log(`🌱  Seeding ${CUSTOMERS} customers...`);

  for (let c = 0; c < CUSTOMERS; c++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const customer = await prisma.customer.create({
      data: {
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        phone: faker.phone.number(),
        birthDate: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
        city: faker.location.city(),
        country: faker.location.country(),
        createdAt: faker.date.past({ years: 3 }),
      },
    });

    const beneficiaryCount = faker.number.int({ min: 2, max: 5 });
    const beneficiaries = [];
    for (let b = 0; b < beneficiaryCount; b++) {
      const beneficiary = await prisma.beneficiary.create({
        data: {
          customerId: customer.id,
          name: faker.helpers.arrayElement([
            faker.person.fullName(),
            faker.company.name(),
          ]),
          iban: faker.finance.iban({ countryCode: 'FR' }),
          bankName: faker.helpers.arrayElement(BANKS),
        },
      });
      beneficiaries.push(beneficiary);
    }

    const accountCount = faker.number.int({ min: 1, max: 3 });
    for (let a = 0; a < accountCount; a++) {
      const type = faker.helpers.arrayElement([AccountType.CHECKING, AccountType.SAVINGS]);
      const openedAt = faker.date.past({ years: 3, refDate: customer.createdAt });

      const account = await prisma.account.create({
        data: {
          customerId: customer.id,
          iban: faker.finance.iban({ countryCode: 'FR' }),
          label: type === AccountType.CHECKING ? 'Current account' : 'Savings account',
          type,
          status: faker.helpers.weightedArrayElement([
            { value: AccountStatus.ACTIVE, weight: 9 },
            { value: AccountStatus.FROZEN, weight: 1 },
          ]),
          currency: 'EUR',
          openedAt,
          balance: 0,
        },
      });

      const txRows = buildTransactions(account.id, type, openedAt);
      await prisma.transaction.createMany({ data: txRows });

      const balance = round2(txRows.reduce((sum, tx) => sum + tx.amount, 0));
      await prisma.account.update({ where: { id: account.id }, data: { balance } });

      const cardRows = buildCards(account.id);
      if (cardRows.length > 0) {
        await prisma.card.createMany({ data: cardRows });
      }

      if (type === AccountType.CHECKING && beneficiaries.length > 0) {
        const transferCount = faker.number.int({ min: 0, max: 6 });
        for (let tf = 0; tf < transferCount; tf++) {
          const beneficiary = faker.helpers.arrayElement(beneficiaries);
          const executedAt = faker.date.recent({ days: 120, refDate: NOW });
          await prisma.transfer.create({
            data: {
              fromAccountId: account.id,
              beneficiaryId: beneficiary.id,
              amount: round2(faker.number.float({ min: 20, max: 1500, fractionDigits: 2 })),
              currency: 'EUR',
              reference: faker.helpers.arrayElement([
                'Rent',
                'Invoice',
                'Loan repayment',
                'Gift',
                'Shared expenses',
                'Subscription',
              ]),
              status: faker.helpers.weightedArrayElement([
                { value: TransferStatus.COMPLETED, weight: 8 },
                { value: TransferStatus.PENDING, weight: 1 },
                { value: TransferStatus.FAILED, weight: 1 },
              ]),
              scheduledAt: faker.datatype.boolean() ? executedAt : null,
              executedAt,
            },
          });
        }
      }
    }
  }

  const [customers, accounts, transactions, cards, beneficiaries, transfers] = await Promise.all([
    prisma.customer.count(),
    prisma.account.count(),
    prisma.transaction.count(),
    prisma.card.count(),
    prisma.beneficiary.count(),
    prisma.transfer.count(),
  ]);

  console.log('✅  Seed complete:');
  console.table({ customers, accounts, transactions, cards, beneficiaries, transfers });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
