import { describe, expect, it } from 'vitest';
import { DBankEventRiskFactorsBuildingService } from '../../../src/application/services/DBankEventRiskFactorsBuildingService';
import type { DBankObservedEventEntity } from '@deepcode/antifraud-dbank-adapter';

describe('DBankEventRiskFactorsBuildingService', () => {
  it('builds scored risk factors from D-bank bridge events', () => {
    const service = new DBankEventRiskFactorsBuildingService();

    expect(
      service.build([
        event('recipient_pasted', 100),
        event('recipient_created', 200),
        event('server_factor_observed', 300, { factor: 'amount_anomaly' }),
      ]),
    ).toEqual([
      {
        kind: 'copy_paste_recipient',
        status: 'ok',
        contribution: 40,
        maxContribution: 40,
        reasonCodes: ['copy_paste_recipient'],
        source: 'live',
        metadata: undefined,
      },
      {
        kind: 'new_recipient',
        status: 'ok',
        contribution: 25,
        maxContribution: 25,
        reasonCodes: ['new_recipient_in_flow'],
        source: 'server',
        metadata: undefined,
      },
      {
        kind: 'amount_anomaly',
        status: 'ok',
        contribution: 30,
        maxContribution: 30,
        reasonCodes: ['amount_anomaly_server_helper'],
        source: 'server',
        metadata: undefined,
      },
    ]);
  });
});

function event(
  kind: DBankObservedEventEntity['kind'],
  atMs: number,
  metadata?: DBankObservedEventEntity['metadata'],
): DBankObservedEventEntity {
  return { kind, atMs, metadata };
}
