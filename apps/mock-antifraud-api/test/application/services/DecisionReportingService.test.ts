import { describe, expect, it } from 'vitest';
import { DecisionReportingService } from '../../../src/application/services/DecisionReportingService';

describe('DecisionReportingService', () => {
  it('accepts a valid decision report', () => {
    const service = new DecisionReportingService();

    expect(
      service.report({
        transactionId: 'tx-1',
        userId: 'u-demo',
        decision: {
          level: 'block',
          score: 87,
          reasons: [{ code: 'safe_account_scam', contribution: 60 }],
          timestamp: '2026-05-11T14:24:12.000Z',
        },
      }),
    ).toEqual({
      accepted: true,
      status: 202,
    });
  });

  it('rejects malformed decision reports', () => {
    const service = new DecisionReportingService();

    expect(() =>
      service.report({
        transactionId: '',
        userId: 'u-demo',
        decision: { level: 'ok', score: 0, reasons: [], timestamp: '2026-05-11T14:24:12.000Z' },
      }),
    ).toThrow('transactionId');
    expect(() =>
      service.report({
        transactionId: 'tx-1',
        userId: '',
        decision: { level: 'ok', score: 0, reasons: [], timestamp: '2026-05-11T14:24:12.000Z' },
      }),
    ).toThrow('userId');
    expect(() =>
      service.report({
        transactionId: 'tx-1',
        userId: 'u-demo',
        decision: { level: 'ok', score: 101, reasons: [], timestamp: '2026-05-11T14:24:12.000Z' },
      }),
    ).toThrow('between 0 and 100');
    expect(() =>
      service.report({
        transactionId: 'tx-1',
        userId: 'u-demo',
        decision: { level: 'ok', score: -1, reasons: [], timestamp: '2026-05-11T14:24:12.000Z' },
      }),
    ).toThrow('between 0 and 100');
  });
});
