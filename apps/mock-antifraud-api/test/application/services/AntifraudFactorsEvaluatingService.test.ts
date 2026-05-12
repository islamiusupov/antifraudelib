import { describe, expect, it } from 'vitest';
import { AntifraudFactorsEvaluatingService } from '../../../src/application/services/AntifraudFactorsEvaluatingService';

describe('AntifraudFactorsEvaluatingService', () => {
  it('returns scenario-specific server-side factor contributions for SEIP demo', () => {
    const service = new AntifraudFactorsEvaluatingService();

    const response = service.evaluate({
      transactionId: 'tx-1',
      userId: 'u-demo',
      scenarioId: 'C1',
      factors: [
        { kind: 'new_recipient' },
        { kind: 'amount_anomaly' },
        { kind: 'recipient_account_age' },
      ],
    });

    expect(response).toMatchObject({
      transactionId: 'tx-1',
      elapsedMs: 42,
      evaluations: [
        {
          kind: 'new_recipient',
          contribution: 25,
          reasonCodes: ['new_recipient_in_cooldown', 'first_tx_to_recipient'],
        },
        {
          kind: 'amount_anomaly',
          contribution: 28,
          reasonCodes: ['amount_above_p95'],
        },
        {
          kind: 'recipient_account_age',
          contribution: 20,
          reasonCodes: ['recipient_account_under_30_days'],
        },
      ],
    });
  });

  it('marks unknown factors without contribution', () => {
    const service = new AntifraudFactorsEvaluatingService();

    const response = service.evaluate({
      transactionId: 'tx-1',
      userId: 'u-demo',
      factors: [{ kind: 'unknown' }],
    });

    expect(response.evaluations[0]).toEqual({
      kind: 'unknown',
      status: 'unknown_factor',
      contribution: 0,
      maxContribution: 0,
      reasonCodes: [],
    });
  });

  it('preserves factor order and returns default max contribution for known factors without a scenario hit', () => {
    const service = new AntifraudFactorsEvaluatingService();

    const response = service.evaluate({
      transactionId: 'tx-1',
      userId: 'u-demo',
      factors: [
        { kind: 'unknown' },
        { kind: 'tls_fingerprint' },
        { kind: 'device_id_per_user_ratio', deviceFingerprintHash: 'sha256:abc' },
      ],
    });

    expect(response.evaluations).toEqual([
      {
        kind: 'unknown',
        status: 'unknown_factor',
        contribution: 0,
        maxContribution: 0,
        reasonCodes: [],
      },
      {
        kind: 'tls_fingerprint',
        status: 'ok',
        contribution: 0,
        maxContribution: 30,
        reasonCodes: [],
        metadata: {},
      },
      {
        kind: 'device_id_per_user_ratio',
        status: 'ok',
        contribution: 0,
        maxContribution: 50,
        reasonCodes: [],
        metadata: {},
      },
    ]);
  });
});
