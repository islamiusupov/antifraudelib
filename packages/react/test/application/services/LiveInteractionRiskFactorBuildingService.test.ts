import { describe, expect, it } from 'vitest';
import { LiveInteractionRiskFactorBuildingService } from '../../../src/application/services/LiveInteractionRiskFactorBuildingService';
import type { LiveInteractionEventEntity } from '../../../src/domain/live/entities/LiveInteractionEventEntity';

describe('LiveInteractionRiskFactorBuildingService', () => {
  it('maps live interaction events into scored risk factors', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('recipient_pasted', 100),
        event('warning_shown', 200),
        event('warning_confirmed', 900),
        event('page_hidden', 1000),
        event('page_visible', 1100),
        event('pointer_anomaly_observed', 1200),
        event('keystroke_anomaly_observed', 1300),
        event('phishing_text_observed', 1400),
        event('native_tampering_observed', 1500),
        event('dev_environment_observed', 1600),
        event('client_environment_observed', 1700),
        event('environment_conflict_observed', 1800),
      ]).map((factor) => [factor.kind, factor.contribution, factor.reasonCodes?.[0]]),
    ).toEqual([
      ['copy_paste_recipient', 40, 'copy_paste_recipient'],
      ['warning_dwell', 18, 'warning_dwell_too_short'],
      ['page_visibility', 20, 'page_visibility_oscillation'],
      ['pointer_pattern', 16, 'pointer_pattern_anomaly'],
      ['keystroke_dynamics', 24, 'keystroke_dynamics_anomaly'],
      ['phishing_text_dom', 60, 'phishing_text_dom'],
      ['native_tampering', 40, 'native_tampering'],
      ['dev_environment', 15, 'dev_environment'],
      ['client_environment', 12, 'client_environment'],
      ['environment_conflicts', 31.5, 'environment_conflicts'],
    ]);
  });

  it('does not emit warning dwell at the exact threshold or page visibility with one side only', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('warning_shown', 0),
        event('warning_confirmed', 1000),
        event('page_hidden', 1100),
      ]),
    ).toEqual([]);
  });
});

function event(kind: LiveInteractionEventEntity['kind'], atMs: number): LiveInteractionEventEntity {
  return {
    kind,
    atMs,
  };
}
