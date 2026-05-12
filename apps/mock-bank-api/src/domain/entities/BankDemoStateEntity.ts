import type { BankAccountEntity } from './BankAccountEntity';
import type { BankBeneficiaryEntity } from './BankBeneficiaryEntity';
import type { BankCardEntity } from './BankCardEntity';
import type { BankDashboardEntity } from './BankDashboardEntity';
import type { BankTransactionEntity } from './BankTransactionEntity';
import type { TransferDraftEntity } from './TransferDraftEntity';

export type BankDemoStateEntity = {
  dashboard: BankDashboardEntity;
  accounts: BankAccountEntity[];
  cards: BankCardEntity[];
  transactions: BankTransactionEntity[];
  beneficiaries: BankBeneficiaryEntity[];
  transferDrafts: TransferDraftEntity[];
};
