import { describe, expect, it } from 'vitest';
import { BankDemoStateResettingService } from '../../../src/application/services/BankDemoStateResettingService';
import { BankTransferConfirmingService } from '../../../src/application/services/BankTransferConfirmingService';
import { BankTransferPreparingService } from '../../../src/application/services/BankTransferPreparingService';

describe('BankTransferConfirmingService', () => {
  it('confirms a prepared transfer and updates account balance plus transaction history', () => {
    const initialState = new BankDemoStateResettingService().reset();
    const prepared = new BankTransferPreparingService().prepare(initialState, {
      sourceAccountId: 'acc-1',
      beneficiaryId: 'ben-1',
      amount: 4380,
      currency: 'RUB',
    });

    const result = new BankTransferConfirmingService().confirm(
      prepared.state,
      prepared.response.draftId,
      new Date('2026-05-11T14:24:12.000Z'),
    );

    expect(result.response).toEqual({
      transactionId: 'tx-local-1778509452000',
      status: 'CONFIRMED',
    });
    expect(result.state.accounts.find((account) => account.id === 'acc-1')?.balance).toBe(423675);
    expect(result.state.transactions[0]).toMatchObject({
      id: 'tx-local-1778509452000',
      title: 'Демо-перевод: Иван Демо',
      amount: -4380,
      status: 'CONFIRMED',
    });
    expect(result.state.transferDrafts[0].confirmed).toBe(true);
  });

  it('rejects unknown or already confirmed drafts', () => {
    const initialState = new BankDemoStateResettingService().reset();
    const preparingService = new BankTransferPreparingService();
    const confirmingService = new BankTransferConfirmingService();
    const prepared = preparingService.prepare(initialState, {
      sourceAccountId: 'acc-1',
      beneficiaryId: 'ben-1',
      amount: 4380,
      currency: 'RUB',
    });

    expect(() => confirmingService.confirm(prepared.state, 'missing')).toThrow('Unknown transfer draft');

    const confirmed = confirmingService.confirm(prepared.state, prepared.response.draftId);

    expect(() => confirmingService.confirm(confirmed.state, prepared.response.draftId)).toThrow(
      'already confirmed',
    );
  });

  it('uses new beneficiary names and caps dashboard recent transactions to five items', () => {
    const initialState = new BankDemoStateResettingService().reset();
    const stateWithFiveTransactions = {
      ...initialState,
      transactions: [
        ...initialState.transactions,
        { ...initialState.transactions[0], id: 'tx-4' },
        { ...initialState.transactions[1], id: 'tx-5' },
      ],
    };
    const prepared = new BankTransferPreparingService().prepare(stateWithFiveTransactions, {
      sourceAccountId: 'acc-1',
      newBeneficiary: {
        name: 'New Beneficiary',
        destination: '40817810000000000001',
      },
      amount: 100,
      currency: 'RUB',
    });

    const result = new BankTransferConfirmingService().confirm(prepared.state, prepared.response.draftId);

    expect(result.state.transactions[0]).toMatchObject({
      title: 'Демо-перевод: New Beneficiary',
      merchantName: 'New Beneficiary',
      amount: -100,
    });
    expect(result.state.dashboard.recentTransactions).toHaveLength(5);
    expect(result.state.dashboard.recentTransactions[0].id).toBe(result.response.transactionId);
  });

  it('rejects a draft whose source account disappeared before confirmation', () => {
    const initialState = new BankDemoStateResettingService().reset();
    const prepared = new BankTransferPreparingService().prepare(initialState, {
      sourceAccountId: 'acc-1',
      beneficiaryId: 'ben-1',
      amount: 100,
      currency: 'RUB',
    });

    expect(() =>
      new BankTransferConfirmingService().confirm(
        {
          ...prepared.state,
          accounts: prepared.state.accounts.filter((account) => account.id !== 'acc-1'),
        },
        prepared.response.draftId,
      ),
    ).toThrow('Unknown source account');
  });
});
