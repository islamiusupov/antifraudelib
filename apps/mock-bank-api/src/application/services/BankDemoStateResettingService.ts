import type { BankDemoStateEntity } from '../../domain/entities/BankDemoStateEntity';

export class BankDemoStateResettingService {
  reset(): BankDemoStateEntity {
    const accounts = [
      {
        id: 'acc-1',
        name: 'Основной демо-счет',
        currency: 'RUB',
        balance: 428055,
        maskedAccountNumber: '**** 1204',
      },
      {
        id: 'acc-2',
        name: 'Демо-счет для поездок',
        currency: 'RUB',
        balance: 98010,
        maskedAccountNumber: '**** 8821',
      },
    ];
    const cards = [
      {
        id: 'card-1',
        accountId: 'acc-1',
        label: 'Демо-дебетовая',
        maskedPan: '**** 4821',
        cardholderName: 'АЛЕКСЕЙ ДЕМО',
        status: 'ACTIVE' as const,
        dailyLimit: 50000,
      },
      {
        id: 'card-2',
        accountId: 'acc-2',
        label: 'Демо-карта для поездок',
        maskedPan: '**** 9134',
        cardholderName: 'АЛЕКСЕЙ ДЕМО',
        status: 'ACTIVE' as const,
        dailyLimit: 35000,
      },
    ];
    const transactions = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        title: 'Демо-покупка продуктов',
        merchantName: 'Демо-маркет',
        amount: -4280,
        currency: 'RUB',
        occurredAt: '2026-05-09T10:15:30Z',
        type: 'CARD_PAYMENT' as const,
        status: 'POSTED' as const,
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        title: 'Демо-зарплата',
        merchantName: 'Демо-работодатель',
        amount: 250000,
        currency: 'RUB',
        occurredAt: '2026-05-07T08:00:00Z',
        type: 'INCOME' as const,
        status: 'POSTED' as const,
      },
      {
        id: 'tx-3',
        accountId: 'acc-2',
        title: 'Демо-билет на транспорт',
        merchantName: 'Демо-транспорт',
        amount: -320,
        currency: 'RUB',
        occurredAt: '2026-05-06T18:45:00Z',
        type: 'CARD_PAYMENT' as const,
        status: 'POSTED' as const,
      },
    ];
    const beneficiaries = [
      {
        id: 'ben-1',
        name: 'Иван Демо',
        type: 'ACCOUNT' as const,
        destinationMasked: '**** 7788',
        trusted: true,
      },
      {
        id: 'ben-2',
        name: 'Мария Тестовая',
        type: 'CARD' as const,
        destinationMasked: '**** 2210',
        trusted: true,
      },
    ];

    return {
      accounts,
      cards,
      transactions,
      beneficiaries,
      transferDrafts: [],
      dashboard: {
        user: {
          userId: 'u-demo',
          login: 'demo@d-bank.test',
          displayName: 'Алексей Демо',
        },
        totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
        accounts,
        cards,
        recentTransactions: transactions,
      },
    };
  }
}
