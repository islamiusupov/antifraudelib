import { describe, expect, it } from 'vitest';
import { DBankLiveFactorExtractingService } from '../../../src/application/services/DBankLiveFactorExtractingService';
import type { DBankObservedEventEntity } from '../../../src/domain/dbank/entities/DBankObservedEventEntity';

describe('DBankLiveFactorExtractingService', () => {
  it('extracts copy-paste recipient and concurrent media live signals', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('recipient_pasted', 100),
        event('media_active', 150),
      ]),
    ).toEqual([
      {
        kind: 'copy_paste_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['copy_paste_recipient'],
        source: 'live',
      },
      {
        kind: 'concurrent_media',
        detected: true,
        confidence: 1,
        reasonCodes: ['concurrent_media_active'],
        source: 'live',
      },
    ]);
  });

  it('extracts copy-paste amount live signals', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(service.extract([event('amount_pasted', 100)])).toEqual([
      {
        kind: 'copy_paste_amount',
        detected: true,
        confidence: 1,
        reasonCodes: ['copy_paste_amount'],
        source: 'live',
      },
    ]);
  });

  it('extracts warning dwell when confirmation is too fast', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('warning_shown', 1000),
        event('warning_scrolled', 1200),
        event('warning_confirmed', 1400),
      ]),
    ).toEqual([
      {
        kind: 'warning_dwell',
        detected: true,
        confidence: 0.9,
        reasonCodes: ['warning_dwell_too_short'],
        source: 'live',
        metadata: {
          fastSkipCount: 1,
          fastestDwellMs: 400,
          minimumDwellMs: 1000,
          noScrollCount: 0,
        },
      },
      {
        kind: 'composite_risk_boost',
        detected: true,
        contribution: 42,
        maxContribution: 42,
        reasonCodes: ['warning_skip_step_up_floor'],
        source: 'live',
        metadata: {
          fastSkipCount: 1,
          fastestDwellMs: 400,
          minimumDwellMs: 1000,
          noScrollCount: 0,
        },
      },
    ]);
  });

  it('extracts no-scroll warning dwell when a warning is skipped too fast without scrolling', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('warning_shown', 1000),
        event('warning_confirmed', 1600),
      ]).map((signal) => signal.reasonCodes),
    ).toEqual([
      ['warning_dwell_too_short', 'warning_no_scroll_dwell_too_short'],
      ['warning_skip_step_up_floor'],
    ]);
  });

  it('extracts a blocking boost when three warning screens are skipped too fast', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('warning_shown', 0),
        event('warning_confirmed', 600),
        event('warning_shown', 2000),
        event('warning_confirmed', 2500),
        event('warning_shown', 4000),
        event('warning_confirmed', 4700),
      ]).map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]),
    ).toEqual([
      ['warning_dwell', undefined, 'warning_skip_series_three_fast_confirmations'],
      ['composite_risk_boost', 65, 'warning_skip_series_block_floor'],
    ]);
  });

  it('extracts multi-field recipient bulk fill as form fill order risk', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(service.extract([event('form_fill_order_observed', 100)])).toEqual([
      {
        kind: 'form_fill_order',
        detected: true,
        confidence: 1,
        reasonCodes: ['multi_field_recipient_bulk_fill'],
        source: 'live',
      },
    ]);
  });

  it('extracts page visibility oscillation from hidden-visible trace', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('page_hidden', 100),
        event('page_visible', 500),
      ]),
    ).toEqual([
      {
        kind: 'page_visibility',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['page_visibility_oscillation'],
        source: 'live',
      },
    ]);
  });

  it('extracts rapid nervous scrolling as pointer pattern risk', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(service.extract([event('rapid_scroll_observed', 100)])).toEqual([
      {
        kind: 'pointer_pattern',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['rapid_scroll_pattern'],
        source: 'paper',
      },
    ]);
  });

  it('extracts click bursts as pointer pattern risk', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(service.extract([event('click_burst_observed', 100)])).toEqual([
      {
        kind: 'pointer_pattern',
        detected: true,
        confidence: 1,
        reasonCodes: ['click_burst_pattern'],
        source: 'live',
      },
    ]);
  });

  it('extracts bridge risk signals added by D-bank 0.2.1', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('recipient_created', 100),
        event('visual_challenge_started', 200),
        event('keystroke_anomaly_observed', 300),
        event('phishing_text_observed', 400),
        event('server_factor_observed', 500, { factor: 'amount_anomaly' }),
      ]).map((signal) => signal.kind),
    ).toEqual([
      'new_recipient',
      'visual_challenge',
      'keystroke_dynamics',
      'phishing_text_dom',
      'amount_anomaly',
    ]);
  });

  it('extracts step-up keystroke reason codes with a boost', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('keystroke_anomaly_observed', 100, {
          reason: 'long_keystroke_pause_instruction_pattern',
        }),
      ]).map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]),
    ).toEqual([
      ['keystroke_dynamics', undefined, 'long_keystroke_pause_instruction_pattern'],
      ['composite_risk_boost', 30, 'keystroke_step_up_floor'],
    ]);
  });

  it('extracts a blocking keystroke boost for Selenium SendKeys signatures', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('keystroke_anomaly_observed', 100, {
          reason: 'selenium_sendkeys_signature',
        }),
      ]).map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]),
    ).toEqual([
      ['keystroke_dynamics', undefined, 'selenium_sendkeys_signature'],
      ['composite_risk_boost', 55, 'keystroke_block_floor'],
    ]);
  });

  it('extracts ONNX not-user keystroke verdicts only with high confidence metadata', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('keystroke_anomaly_observed', 100, {
          confidence: 0.91,
          reason: 'onnx_not_user_high_confidence',
          verdict: 'not_user',
        }),
      ]).map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]),
    ).toEqual([
      ['keystroke_dynamics', undefined, 'onnx_not_user_high_confidence'],
      ['composite_risk_boost', 30, 'keystroke_step_up_floor'],
    ]);
  });

  it('does not extract risk for allow keystroke verdicts from D-bank callbacks', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('keystroke_anomaly_observed', 100, {
          reason: 'local_baseline_scaled_manhattan_match',
          scaledManhattanDistance: 0.12,
          threshold: 0.75,
        }),
        event('keystroke_anomaly_observed', 200, {
          confidence: 0.86,
          reason: 'onnx_user_match_high_confidence',
          verdict: 'match',
        }),
        event('keystroke_anomaly_observed', 300, {
          cadenceRatio: 1.6,
          reason: 'local_baseline_slow_cadence_match',
        }),
        event('keystroke_anomaly_observed', 400, {
          cadenceRatio: 0.6,
          reason: 'local_baseline_fast_cadence_match',
        }),
      ]),
    ).toEqual([]);
  });

  it.each([
    'baseline_insufficient_new_user',
    'input_method_split_baseline',
    'keyboard_layout_changed_ngram_set',
  ])('extracts %s as monitor-strength keystroke dynamics', (reason) => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('keystroke_anomaly_observed', 100, {
          reason,
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'keystroke_dynamics',
        confidence: 1,
        reasonCodes: [reason],
      }),
    ]);
  });

  it('extracts missing typing corrections as monitor-strength keystroke dynamics', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('keystroke_anomaly_observed', 100, {
          reason: 'missing_typing_corrections',
        }),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'keystroke_dynamics',
        confidence: 1,
        reasonCodes: ['missing_typing_corrections'],
      }),
    ]);
  });

  it('treats raw UI recipient creation as a low-confidence signal', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(service.extract([event('recipient_created', 100)])).toEqual([
      {
        kind: 'new_recipient',
        detected: true,
        confidence: 0.4,
        reasonCodes: ['new_recipient_ui_only'],
        source: 'server',
        metadata: {
          rawEventKind: 'recipient_created',
        },
      },
    ]);
  });

  it('uses full confidence when recipient creation carries server verification metadata', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('recipient_created', 100, {
          serverVerified: true,
          recipientAgeHours: 1,
          txCountToRecipient: 0,
        }),
      ]),
    ).toEqual([
      {
        kind: 'new_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_in_flow'],
        source: 'server',
        metadata: {
          serverVerified: true,
          recipientAgeHours: 1,
          txCountToRecipient: 0,
        },
      },
    ]);
  });

  it('adds a step-up boost when a recipient is created in the current session with no previous use', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('recipient_created', 100, {
          serverVerified: true,
          createdInCurrentSession: true,
          txCountToRecipient: 0,
        }),
      ]),
    ).toEqual([
      {
        kind: 'new_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_in_flow'],
        source: 'server',
        metadata: {
          serverVerified: true,
          createdInCurrentSession: true,
          txCountToRecipient: 0,
        },
      },
      {
        kind: 'composite_risk_boost',
        detected: true,
        contribution: 35,
        maxContribution: 35,
        reasonCodes: ['recipient_added_current_session_no_previous_use'],
        source: 'server',
        metadata: {
          serverVerified: true,
          createdInCurrentSession: true,
          txCountToRecipient: 0,
        },
      },
    ]);
  });

  it('adds only a monitor boost for a new recipient with a small test-payment transfer', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
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
      {
        kind: 'new_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_in_flow'],
        source: 'server',
        metadata: {
          serverVerified: true,
          createdInCurrentSession: true,
          txCountToRecipient: 0,
        },
      },
      {
        kind: 'composite_risk_boost',
        detected: true,
        contribution: 5,
        maxContribution: 5,
        reasonCodes: ['new_recipient_small_test_payment_pattern'],
        source: 'server',
        metadata: {
          amount: 250,
          paymentPattern: 'test-payment',
        },
      },
    ]);
  });

  it('does not add a small test-payment boost without a test-payment marker', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('recipient_created', 100),
        event('transfer_submitted', 500, { amount: 250 }),
      ]),
    ).toEqual([
      {
        kind: 'new_recipient',
        detected: true,
        confidence: 0.4,
        reasonCodes: ['new_recipient_ui_only'],
        source: 'server',
        metadata: {
          rawEventKind: 'recipient_created',
        },
      },
    ]);
  });

  it('extracts recipient velocity and velocity anomaly from three new recipients with different amounts in one hour', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('recipient_created', 100, { recipientId: 'r-1', amount: 1000 }),
        event('recipient_created', 1000, { recipientId: 'r-2', amount: 2200 }),
        event('recipient_created', 3000, { recipientId: 'r-3', amount: 3600 }),
      ]),
    ).toEqual([
      {
        kind: 'new_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_layering_pattern'],
        source: 'server',
        metadata: { recipientId: 'r-1', amount: 1000 },
      },
      {
        kind: 'recipient_velocity',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_layering_pattern'],
        source: 'server',
      },
      {
        kind: 'velocity_anomaly',
        detected: true,
        confidence: 1,
        reasonCodes: ['layering_different_amounts'],
        source: 'server',
      },
    ]);
  });

  it('does not extract layering when new recipient amounts are the same', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('recipient_created', 100, { recipientId: 'r-1', amount: 1000 }),
        event('recipient_created', 1000, { recipientId: 'r-2', amount: 1000 }),
        event('recipient_created', 3000, { recipientId: 'r-3', amount: 1000 }),
      ]),
    ).toEqual([
      {
        kind: 'new_recipient',
        detected: true,
        confidence: 0.4,
        reasonCodes: ['new_recipient_ui_only'],
        source: 'server',
        metadata: {
          rawEventKind: 'recipient_created',
        },
      },
    ]);
  });

  it('ignores malformed server factor events without a string factor metadata value', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('server_factor_observed', 100),
        event('server_factor_observed', 200, { factor: 123 }),
      ]),
    ).toEqual([]);
  });

  it('uses reason codes emitted by D-bank server factor callbacks', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('server_factor_observed', 100, {
          factor: 'amount_anomaly',
          reason: 'amount_above_p95',
        }),
        event('server_factor_observed', 200, {
          factor: 'recipient_velocity',
          reasonCodes: ['new_recipient_layering_pattern'],
        }),
      ]),
    ).toEqual([
      {
        kind: 'amount_anomaly',
        detected: true,
        confidence: 1,
        reasonCodes: ['amount_above_p95'],
        source: 'server',
        metadata: {
          factor: 'amount_anomaly',
          reason: 'amount_above_p95',
        },
      },
      {
        kind: 'recipient_velocity',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_layering_pattern'],
        source: 'server',
        metadata: {
          factor: 'recipient_velocity',
          reasonCodes: ['new_recipient_layering_pattern'],
        },
      },
    ]);
  });

  it('does not flag warning dwell when confirmation takes at least one second', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('warning_shown', 1000),
        event('warning_confirmed', 2000),
      ]),
    ).toEqual([]);
  });
});

function event(
  kind: DBankObservedEventEntity['kind'],
  atMs: number,
  metadata?: DBankObservedEventEntity['metadata'],
): DBankObservedEventEntity {
  return { kind, atMs, metadata };
}
