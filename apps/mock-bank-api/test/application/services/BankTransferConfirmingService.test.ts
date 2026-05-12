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
});
