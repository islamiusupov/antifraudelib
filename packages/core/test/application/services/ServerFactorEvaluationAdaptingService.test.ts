import { describe, expect, it } from 'vitest';
import { ServerFactorEvaluationAdaptingService } from '../../../src/application/services/ServerFactorEvaluationAdaptingService';

describe('ServerFactorEvaluationAdaptingService', () => {
  it('adapts ok server helper evaluations into risk factors', () => {
    const service = new ServerFactorEvaluationAdaptingService();

    expect(
      service.adapt([
        {
          kind: 'new_recipient',
          status: 'ok',
          contribution: 25,
          maxContribution: 25,
          reasonCodes: ['new_recipient_in_cooldown'],
        },
      ]),
    ).toEqual([
      {
        kind: 'new_recipient',
        status: 'ok',
        contribution: 25,
        maxContribution: 25,
        reasonCodes: ['new_recipient_in_cooldown'],
        source: 'server',
        metadata: undefined,
      },
    ]);
  });

  it('keeps failed server helper evaluations visible but non-scoring', () => {
    const service = new ServerFactorEvaluationAdaptingService();

    expect(
      service.adapt([
        {
          kind: 'geoip_jump',
          status: 'timeout',
          contribution: 30,
          maxContribution: 30,
          reasonCodes: ['geoip_impossible_travel'],
        },
      ]),
    ).toEqual([
      {
        kind: 'geoip_jump',
        status: 'timeout',
        contribution: 0,
        maxContribution: 30,
        reasonCodes: ['geoip_impossible_travel'],
        source: 'server',
        metadata: undefined,
      },
    ]);
  });
});
