import type { BankAccountEntity } from './BankAccountEntity';
import type { BankCardEntity } from './BankCardEntity';
import type { BankTransactionEntity } from './BankTransactionEntity';
import type { BankUserEntity } from './BankUserEntity';

export type BankDashboardEntity = {
  user: BankUserEntity;
  totalBalance: number;
  accounts: BankAccountEntity[];
  cards: BankCardEntity[];
  recentTransactions: BankTransactionEntity[];
};
