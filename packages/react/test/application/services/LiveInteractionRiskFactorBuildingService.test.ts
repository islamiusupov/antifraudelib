import { describe, expect, it } from 'vitest';
import { LiveInteractionRiskFactorBuildingService } from '../../../src/application/services/LiveInteractionRiskFactorBuildingService';
import type { LiveInteractionEventEntity } from '../../../src/domain/live/entities/LiveInteractionEventEntity';

describe('LiveInteractionRiskFactorBuildingService', () => {
  it('maps live interaction events into scored risk factors', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('recipient_pasted', 100),
        event('amount_pasted', 150),
        event('warning_shown', 200),
        event('warning_confirmed', 900),
        event('form_fill_order_observed', 950),
        event('page_hidden', 1000),
        event('page_visible', 1100),
        event('pointer_anomaly_observed', 1200),
        event('rapid_scroll_observed', 1250),
        event('keystroke_anomaly_observed', 1300),
        event('phishing_text_observed', 1400),
        event('native_tampering_observed', 1500),
        event('dev_environment_observed', 1600),
        event('client_environment_observed', 1700),
        event('environment_conflict_observed', 1800),
      ]).map((factor) => [factor.kind, factor.contribution, factor.reasonCodes?.[0]]),
    ).toEqual([
      ['copy_paste_recipient', 40, 'copy_paste_recipient'],
      ['copy_paste_amount', 20, 'copy_paste_amount'],
      ['form_fill_order', 20, 'multi_field_recipient_bulk_fill'],
      ['warning_dwell', 18, 'warning_dwell_too_short'],
      ['composite_risk_boost', 42, 'warning_skip_step_up_floor'],
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

  it('maps three fast warning confirmations to a blocking warning series boost', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('warning_shown', 0),
        event('warning_confirmed', 600),
        event('warning_shown', 2000),
        event('warning_confirmed', 2500),
        event('warning_shown', 4000),
        event('warning_confirmed', 4700),
      ]).map((factor) => [factor.kind, factor.contribution, factor.reasonCodes?.[0]]),
    ).toEqual([
      ['warning_dwell', 20, 'warning_skip_series_three_fast_confirmations'],
      ['composite_risk_boost', 65, 'warning_skip_series_block_floor'],
    ]);
  });

  it('maps rapid nervous scroll to pointer pattern risk', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(service.build([event('rapid_scroll_observed', 100)]).map((factor) => factor.reasonCodes)).toEqual([
      ['rapid_scroll_pattern'],
    ]);
  });

  it('maps click bursts to pointer pattern risk', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(service.build([event('click_burst_observed', 100)]))
      .toEqual([
        expect.objectContaining({
          kind: 'pointer_pattern',
          contribution: 20,
          reasonCodes: ['click_burst_pattern'],
        }),
      ]);
  });

  it('maps step-up keystroke reasons to keystroke dynamics with a boost', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('keystroke_anomaly_observed', 100, {
          reason: 'uniform_keystroke_interval_automation',
        }),
      ]).map((factor) => [factor.kind, factor.contribution, factor.reasonCodes?.[0]]),
    ).toEqual([
      ['keystroke_dynamics', 30, 'uniform_keystroke_interval_automation'],
      ['composite_risk_boost', 30, 'keystroke_step_up_floor'],
    ]);
  });

  it('maps Selenium SendKeys signatures to a blocking keystroke floor', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('keystroke_anomaly_observed', 100, {
          reason: 'selenium_sendkeys_signature',
        }),
      ]).map((factor) => [factor.kind, factor.contribution, factor.reasonCodes?.[0]]),
    ).toEqual([
      ['keystroke_dynamics', 30, 'selenium_sendkeys_signature'],
      ['composite_risk_boost', 55, 'keystroke_block_floor'],
    ]);
  });

  it('uses ONNX confidence metadata when mapping not-user verdicts', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('keystroke_anomaly_observed', 100, {
          confidence: 0.91,
          reason: 'onnx_not_user_high_confidence',
          verdict: 'not_user',
        }),
      ]).map((factor) => [factor.kind, factor.contribution, factor.reasonCodes?.[0]]),
    ).toEqual([
      ['keystroke_dynamics', 30, 'onnx_not_user_high_confidence'],
      ['composite_risk_boost', 30, 'keystroke_step_up_floor'],
    ]);
  });

  it.each([
    { confidence: 0.86, reason: 'onnx_user_match_high_confidence', verdict: 'match' },
    { reason: 'local_baseline_scaled_manhattan_match', scaledManhattanDistance: 0.12, threshold: 0.75 },
    { cadenceRatio: 1.6, reason: 'local_baseline_slow_cadence_match' },
    { cadenceRatio: 0.6, reason: 'local_baseline_fast_cadence_match' },
  ])('does not emit risk factors for allow keystroke verdicts', (metadata) => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(service.build([event('keystroke_anomaly_observed', 100, metadata)])).toEqual([]);
  });

  it.each([
    'baseline_insufficient_new_user',
    'input_method_split_baseline',
    'keyboard_layout_changed_ngram_set',
  ])('maps %s to monitor-strength keystroke dynamics', (reason) => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('keystroke_anomaly_observed', 100, {
          reason,
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'keystroke_dynamics',
        contribution: 30,
        reasonCodes: [reason],
      }),
    ]);
  });

  it('maps missing typing corrections to monitor-strength keystroke dynamics', () => {
    const service = new LiveInteractionRiskFactorBuildingService();

    expect(
      service.build([
        event('keystroke_anomaly_observed', 100, {
          reason: 'missing_typing_corrections',
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'keystroke_dynamics',
        contribution: 30,
        reasonCodes: ['missing_typing_corrections'],
      }),
    ]);
  });
});

function event(
  kind: LiveInteractionEventEntity['kind'],
  atMs: number,
  metadata?: Record<string, unknown>,
): LiveInteractionEventEntity {
  return {
    kind,
    atMs,
    metadata,
  };
}
