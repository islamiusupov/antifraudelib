import type { BankAccount } from './BankAccount';
import type { BankBeneficiary } from './BankBeneficiary';
import type { BankCard } from './BankCard';
import type { BankDashboard } from './BankDashboard';
import type { BankTransaction } from './BankTransaction';
import type { TransferDraft } from './TransferDraft';

export type BankDemoState = {
  dashboard: BankDashboard;
  accounts: BankAccount[];
  cards: BankCard[];
  transactions: BankTransaction[];
  beneficiaries: BankBeneficiary[];
  transferDrafts: TransferDraft[];
};
