import { describe, expect, it } from 'vitest';
import { BankDemoStateResettingService } from '../../../src/application/services/BankDemoStateResettingService';
import { BankTransferPreparingService } from '../../../src/application/services/BankTransferPreparingService';

describe('BankTransferPreparingService', () => {
  it('creates a transfer draft and risk-evaluated response', () => {
    const state = new BankDemoStateResettingService().reset();
    const service = new BankTransferPreparingService();

    const result = service.prepare(
      state,
      {
        sourceAccountId: 'acc-1',
        beneficiaryId: 'ben-1',
        amount: 4380,
        currency: 'RUB',
      },
      new Date('2026-05-11T14:23:45.000Z'),
    );

    expect(result.response).toMatchObject({
      draftId: 'td-local-1778509425000',
      status: 'RISK_EVALUATED',
      riskDecision: {
        score: 0,
        tier: 'ALLOW',
      },
    });
    expect(result.state.transferDrafts).toHaveLength(1);
    expect(result.state.transferDrafts[0].confirmed).toBe(false);
  });

  it('rejects invalid transfer requests', () => {
    const state = new BankDemoStateResettingService().reset();
    const service = new BankTransferPreparingService();

    expect(() =>
      service.prepare(state, {
        sourceAccountId: 'missing',
        beneficiaryId: 'ben-1',
        amount: 100,
        currency: 'RUB',
      }),
    ).toThrow('Unknown source account');
    expect(() =>
      service.prepare(state, {
        sourceAccountId: 'acc-1',
        amount: 100,
        currency: 'RUB',
      }),
    ).toThrow('Transfer requires');
    expect(() =>
      service.prepare(state, {
        sourceAccountId: 'acc-1',
        beneficiaryId: 'ben-1',
        amount: -1,
        currency: 'RUB',
      }),
    ).toThrow('positive');
  });
});
