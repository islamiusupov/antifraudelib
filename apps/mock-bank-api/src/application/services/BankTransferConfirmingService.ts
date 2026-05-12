import type { BankDemoStateEntity } from '../../domain/bank/entities/BankDemoStateEntity';
import type { BankTransactionEntity } from '../../domain/bank/entities/BankTransactionEntity';
import type { TransferConfirmResultEntity } from '../../domain/bank/entities/TransferConfirmResultEntity';

export type BankTransferConfirmingResult = {
  state: BankDemoStateEntity;
  response: TransferConfirmResultEntity;
};

export class BankTransferConfirmingService {
  confirm(
    state: BankDemoStateEntity,
    draftId: string,
    now = new Date('2026-05-11T14:24:12.000Z'),
  ): BankTransferConfirmingResult {
    const draft = state.transferDrafts.find((candidate) => candidate.draftId === draftId);
    if (!draft) {
      throw new Error(`Unknown transfer draft: ${draftId}`);
    }
    if (draft.confirmed) {
      throw new Error(`Transfer draft already confirmed: ${draftId}`);
    }

    const sourceAccount = state.accounts.find((account) => account.id === draft.request.sourceAccountId);
    if (!sourceAccount) {
      throw new Error(`Unknown source account: ${draft.request.sourceAccountId}`);
    }

    const transactionId = `tx-local-${now.getTime()}`;
    const beneficiaryName = this.resolveBeneficiaryName(state, draft);
    const transaction: BankTransactionEntity = {
      id: transactionId,
      accountId: sourceAccount.id,
      title: `Демо-перевод: ${beneficiaryName}`,
      merchantName: beneficiaryName,
      amount: -Math.abs(draft.request.amount),
      currency: draft.request.currency,
      occurredAt: now.toISOString(),
      type: 'TRANSFER',
      status: 'CONFIRMED',
    };
    const accounts = state.accounts.map((account) =>
      account.id === sourceAccount.id
        ? { ...account, balance: account.balance - draft.request.amount }
        : account,
    );
    const transactions = [transaction, ...state.transactions];

    return {
      response: {
        transactionId,
        status: 'CONFIRMED',
      },
      state: {
        ...state,
        accounts,
        transactions,
        transferDrafts: state.transferDrafts.map((candidate) =>
          candidate.draftId === draftId ? { ...candidate, confirmed: true } : candidate,
        ),
        dashboard: {
          ...state.dashboard,
          totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
          accounts,
          recentTransactions: transactions.slice(0, 5),
        },
      },
    };
  }

  private resolveBeneficiaryName(state: BankDemoStateEntity, draft: BankDemoStateEntity['transferDrafts'][number]): string {
    if (draft.request.newBeneficiary) {
      return draft.request.newBeneficiary.name;
    }
    const beneficiary = state.beneficiaries.find((candidate) => candidate.id === draft.request.beneficiaryId);
    return beneficiary?.name ?? 'Демо-получатель';
  }
}
