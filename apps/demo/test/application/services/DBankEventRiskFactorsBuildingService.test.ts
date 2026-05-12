import { describe, expect, it } from 'vitest';
import { DBankEventRiskFactorsBuildingService } from '../../../src/application/services/DBankEventRiskFactorsBuildingService';
import type { DBankObservedEventEntity } from '@deepcode/antifraud-dbank-adapter';

describe('DBankEventRiskFactorsBuildingService', () => {
  it('builds scored risk factors from D-bank bridge events', () => {
    const service = new DBankEventRiskFactorsBuildingService();

    expect(
      service.build([
        event('recipient_pasted', 100),
        event('amount_pasted', 150),
        event('form_fill_order_observed', 175),
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
        kind: 'copy_paste_amount',
        status: 'ok',
        contribution: 20,
        maxContribution: 20,
        reasonCodes: ['copy_paste_amount'],
        source: 'live',
        metadata: undefined,
      },
      {
        kind: 'new_recipient',
        status: 'ok',
        contribution: 10,
        maxContribution: 25,
        reasonCodes: ['new_recipient_ui_only'],
        source: 'server',
        metadata: {
          rawEventKind: 'recipient_created',
        },
      },
      {
        kind: 'form_fill_order',
        status: 'ok',
        contribution: 20,
        maxContribution: 20,
        reasonCodes: ['multi_field_recipient_bulk_fill'],
        source: 'live',
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

  it('returns no factors for empty event streams', () => {
    const service = new DBankEventRiskFactorsBuildingService();

    expect(service.build([])).toEqual([]);
  });

  it('ignores server factor events without a string factor name', () => {
    const service = new DBankEventRiskFactorsBuildingService();

    expect(
      service.build([
        event('server_factor_observed', 100),
        event('server_factor_observed', 200, { factor: ['amount_anomaly'] }),
      ]),
    ).toEqual([]);
  });

  it('scores a current-session unused recipient as step-up ready factors', () => {
    const service = new DBankEventRiskFactorsBuildingService();

    expect(
      service.build([
        event('recipient_created', 100, {
          serverVerified: true,
          createdInCurrentSession: true,
          txCountToRecipient: 0,
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'new_recipient',
        contribution: 25,
        maxContribution: 25,
        reasonCodes: ['new_recipient_in_flow'],
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 35,
        maxContribution: 35,
        reasonCodes: ['recipient_added_current_session_no_previous_use'],
      }),
    ]);
  });

  it('scores a new recipient small test-payment pattern as monitor ready factors', () => {
    const service = new DBankEventRiskFactorsBuildingService();

    expect(
      service.build([
        event('recipient_created', 100, {
          serverVerified: true,
          createdInCurrentSession: true,
          txCountToRecipient: 0,
        }),
        event('transfer_submitted', 500, {
          amount: 250,
          paymentPattern: 'test-payment',
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'new_recipient',
        contribution: 25,
        maxContribution: 25,
        reasonCodes: ['new_recipient_in_flow'],
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 5,
        maxContribution: 5,
        reasonCodes: ['new_recipient_small_test_payment_pattern'],
      }),
    ]);
  });

  it('scores a three-recipient layering trace as recipient and velocity factors', () => {
    const service = new DBankEventRiskFactorsBuildingService();

    expect(
      service.build([
        event('recipient_created', 100, { recipientId: 'r-1', amount: 1000 }),
        event('recipient_created', 1000, { recipientId: 'r-2', amount: 2200 }),
        event('recipient_created', 3000, { recipientId: 'r-3', amount: 3600 }),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'new_recipient',
        contribution: 25,
        maxContribution: 25,
        reasonCodes: ['new_recipient_layering_pattern'],
      }),
      expect.objectContaining({
        kind: 'recipient_velocity',
        contribution: 35,
        maxContribution: 35,
        reasonCodes: ['new_recipient_layering_pattern'],
      }),
      expect.objectContaining({
        kind: 'velocity_anomaly',
        contribution: 25,
        maxContribution: 25,
        reasonCodes: ['layering_different_amounts'],
      }),
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
