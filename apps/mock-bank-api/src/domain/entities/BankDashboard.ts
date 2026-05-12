import type { BankAccount } from './BankAccount';
import type { BankCard } from './BankCard';
import type { BankTransaction } from './BankTransaction';
import type { BankUser } from './BankUser';

export type BankDashboard = {
  user: BankUser;
  totalBalance: number;
  accounts: BankAccount[];
  cards: BankCard[];
  recentTransactions: BankTransaction[];
};
