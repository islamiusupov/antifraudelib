import { describe, expect, it } from 'vitest';
import { BankDemoStateResettingService } from '../../../src/application/services/BankDemoStateResettingService';

describe('BankDemoStateResettingService', () => {
  it('creates the default D-bank demo state expected by the frontend', () => {
    const state = new BankDemoStateResettingService().reset();

    expect(state.dashboard.user).toMatchObject({
      userId: 'u-demo',
      login: 'demo@d-bank.test',
    });
    expect(state.accounts).toHaveLength(2);
    expect(state.cards).toHaveLength(2);
    expect(state.transactions).toHaveLength(3);
    expect(state.beneficiaries).toHaveLength(2);
    expect(state.transferDrafts).toEqual([]);
    expect(state.dashboard.totalBalance).toBe(526065);
  });

  it('returns a fresh state object on every reset', () => {
    const service = new BankDemoStateResettingService();
    const first = service.reset();
    const second = service.reset();

    first.accounts[0].balance = 0;

    expect(second.accounts[0].balance).toBe(428055);
  });
});
