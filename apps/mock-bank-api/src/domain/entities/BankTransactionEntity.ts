export type BankTransactionEntity = {
  id: string;
  accountId: string;
  title: string;
  merchantName: string;
  amount: number;
  currency: string;
  occurredAt: string;
  type: 'CARD_PAYMENT' | 'INCOME' | 'TRANSFER';
  status: 'POSTED' | 'CONFIRMED' | 'PENDING';
};
