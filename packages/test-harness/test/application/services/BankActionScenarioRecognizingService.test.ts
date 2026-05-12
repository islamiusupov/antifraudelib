import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ScenarioCatalogParsingService } from '@deepcode/antifraud-scenario-catalog';
import { BankActionScenarioRecognizingService } from '../../../src/application/services/BankActionScenarioRecognizingService';
import type { BankActionEntity } from '../../../src/domain/harness/entities/BankActionEntity';

describe('BankActionScenarioRecognizingService', () => {
  it('recognizes copy-paste recipient scenarios from D-bank action traces', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('bank_opened', 0),
        action('transfer_opened', 100),
        action('recipient_pasted', 300),
        action('transfer_submitted', 900),
      ],
      catalog(),
    );

    expect(result.status).toBe('recognized');
    expect(result.compositeRecognitions).toEqual([]);
    expect(result.recognitions[0]).toMatchObject({
      factor: 'copy_paste_recipient',
      confidence: 1,
      candidateScenarioIds: expect.arrayContaining(['CPY-01', 'CPY-20']),
    });
    expect(result.riskSignals[0]).toMatchObject({
      kind: 'copy_paste_recipient',
      detected: true,
      confidence: 1,
      reasonCodes: ['copy_paste_recipient'],
    });
  });

  it('recognizes multiple factors from one bank trace', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('bank_opened', 0),
        action('media_active', 50),
        action('transfer_opened', 100),
        action('recipient_created', 200),
        action('warning_shown', 400),
        action('warning_confirmed', 900),
        action('transfer_submitted', 1000),
      ],
      catalog(),
    );

    expect(result.recognitions.map((recognition) => recognition.factor)).toEqual([
      'concurrent_media',
      'new_recipient',
      'warning_dwell',
      'composite_risk_boost',
    ]);
    expect(result.riskSignals.map((signal) => signal.kind)).toEqual([
      'concurrent_media',
      'new_recipient',
      'warning_dwell',
      'composite_risk_boost',
    ]);
  });

  it('returns no_match for traces without suspicious bank actions', () => {
    const service = new BankActionScenarioRecognizingService();

    expect(service.recognize([action('bank_opened', 0), action('transfer_opened', 100)], catalog())).toMatchObject({
      status: 'no_match',
      recognitions: [],
      compositeRecognitions: [],
      riskSignals: [],
    });
  });

  it('does not recognize warning dwell when confirmation happens exactly at the threshold', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [action('warning_shown', 0), action('warning_confirmed', 1000)],
      catalog(),
    );

    expect(result.recognitions.some((recognition) => recognition.factor === 'warning_dwell')).toBe(false);
    expect(result.status).toBe('no_match');
  });

  it('recognizes no-scroll warning dwell when confirmation is below the dwell minimum', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [action('warning_shown', 0), action('warning_confirmed', 600)],
      catalog(),
    );

    expect(result.recognitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factor: 'warning_dwell',
          reasonCodes: ['warning_dwell_too_short', 'warning_no_scroll_dwell_too_short'],
        }),
        expect.objectContaining({
          factor: 'composite_risk_boost',
          contribution: 42,
          reasonCodes: ['warning_skip_step_up_floor'],
        }),
      ]),
    );
  });

  it('recognizes a blocking warning dwell series after three fast confirmations', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('warning_shown', 0),
        action('warning_confirmed', 600),
        action('warning_shown', 2000),
        action('warning_confirmed', 2500),
        action('warning_shown', 4000),
        action('warning_confirmed', 4700),
      ],
      catalog(),
    );

    expect(result.riskSignals.map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]))
      .toEqual([
        ['warning_dwell', undefined, 'warning_skip_series_three_fast_confirmations'],
        ['composite_risk_boost', 65, 'warning_skip_series_block_floor'],
      ]);
  });

  it.each([
    ['media_active', 'concurrent_media', ['concurrent_media_active']],
    ['recipient_created', 'new_recipient', ['new_recipient_in_flow']],
    ['recipient_pasted', 'copy_paste_recipient', ['copy_paste_recipient']],
    ['amount_pasted', 'copy_paste_amount', ['copy_paste_amount']],
    ['form_fill_order_observed', 'form_fill_order', ['multi_field_recipient_bulk_fill']],
    ['page_hidden', 'page_visibility', ['page_visibility_oscillation']],
    ['visual_challenge_started', 'visual_challenge', ['visual_challenge_started']],
    ['keystroke_anomaly_observed', 'keystroke_dynamics', ['keystroke_dynamics_anomaly']],
    ['pointer_anomaly_observed', 'pointer_pattern', ['pointer_pattern_anomaly']],
    ['rapid_scroll_observed', 'pointer_pattern', ['rapid_scroll_pattern']],
    ['click_burst_observed', 'pointer_pattern', ['click_burst_pattern']],
    ['native_tampering_observed', 'native_tampering', ['native_tampering']],
    ['dev_environment_observed', 'dev_environment', ['dev_environment']],
    ['bot_detected', 'bot_detection', ['bot_detection']],
    ['phishing_text_observed', 'phishing_text_dom', ['phishing_text_dom']],
    ['phishing_url_observed', 'phishing_url', ['phishing_url_pattern']],
    ['token_injection_observed', 'recent_token_injection', ['recent_token_injection']],
    ['client_environment_observed', 'client_environment', ['client_environment']],
    ['environment_conflict_observed', 'environment_conflicts', ['environment_conflicts']],
    ['device_fingerprint_observed', 'device_fingerprint', ['device_fingerprint']],
  ] as Array<[BankActionEntity['kind'], string, string[]]>)(
    'recognizes %s as %s',
    (kind, expectedFactor, expectedReasonCodes) => {
      const service = new BankActionScenarioRecognizingService();
      const actions = kind === 'page_hidden'
        ? [action('page_hidden', 100), action('page_visible', 300)]
        : [action(kind, 100)];

      const result = service.recognize(actions, catalog());

      expect(result.recognitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            factor: expectedFactor,
            reasonCodes: expectedReasonCodes,
          }),
        ]),
      );
    },
  );

  it('accepts string server factor metadata and ignores malformed server factor metadata', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('server_factor_observed', 100, { factor: 'tls_fingerprint' }),
        action('server_factor_observed', 150, { factor: 'amount_anomaly', reason: 'amount_above_p95' }),
        action('server_factor_observed', 200, { factor: ['device_fingerprint'] }),
        action('server_factor_observed', 300),
      ],
      catalog(),
    );

    expect(result.recognitions).toEqual([
      expect.objectContaining({
        factor: 'tls_fingerprint',
        confidence: 1,
        reasonCodes: ['tls_fingerprint_server_helper'],
        candidateScenarioIds: [],
      }),
      expect.objectContaining({
        factor: 'amount_anomaly',
        confidence: 1,
        reasonCodes: ['amount_above_p95'],
        candidateScenarioIds: [],
        metadata: {
          factor: 'amount_anomaly',
          reason: 'amount_above_p95',
        },
      }),
    ]);
    expect(result.riskSignals).toEqual([
      expect.objectContaining({
        kind: 'tls_fingerprint',
        source: 'live',
      }),
      expect.objectContaining({
        kind: 'amount_anomaly',
        reasonCodes: ['amount_above_p95'],
        metadata: {
          factor: 'amount_anomaly',
          reason: 'amount_above_p95',
        },
      }),
    ]);
  });

  it('recognizes step-up keystroke reason codes with a boost', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('keystroke_anomaly_observed', 100, {
          reason: 'short_key_hold_time_automation',
        }),
      ],
      catalog(),
    );

    expect(result.riskSignals.map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]))
      .toEqual([
        ['keystroke_dynamics', undefined, 'short_key_hold_time_automation'],
        ['composite_risk_boost', 30, 'keystroke_step_up_floor'],
      ]);
  });

  it('recognizes Selenium SendKeys signatures as blocking keystroke traces', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('keystroke_anomaly_observed', 100, {
          reason: 'selenium_sendkeys_signature',
        }),
      ],
      catalog(),
    );

    expect(result.riskSignals.map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]))
      .toEqual([
        ['keystroke_dynamics', undefined, 'selenium_sendkeys_signature'],
        ['composite_risk_boost', 55, 'keystroke_block_floor'],
      ]);
  });

  it('recognizes high-confidence ONNX not-user verdicts from bank action metadata', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('keystroke_anomaly_observed', 100, {
          confidence: 0.91,
          reason: 'onnx_not_user_high_confidence',
          verdict: 'not_user',
        }),
      ],
      catalog(),
    );

    expect(result.riskSignals.map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]))
      .toEqual([
        ['keystroke_dynamics', undefined, 'onnx_not_user_high_confidence'],
        ['composite_risk_boost', 30, 'keystroke_step_up_floor'],
      ]);
  });

  it('does not recognize allow keystroke verdicts as risk traces', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('keystroke_anomaly_observed', 100, {
          reason: 'local_baseline_scaled_manhattan_match',
          scaledManhattanDistance: 0.12,
          threshold: 0.75,
        }),
      ],
      catalog(),
    );

    expect(result.status).toBe('no_match');
    expect(result.recognitions).toEqual([]);
    expect(result.riskSignals).toEqual([]);
  });

  it('recognizes missing typing corrections as monitor-strength keystroke dynamics', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('keystroke_anomaly_observed', 100, {
          reason: 'missing_typing_corrections',
        }),
      ],
      catalog(),
    );

    expect(result.recognitions).toEqual([
      expect.objectContaining({
        factor: 'keystroke_dynamics',
        confidence: 1,
        reasonCodes: ['missing_typing_corrections'],
      }),
    ]);
  });

  it('recognizes NRC-03 current-session recipient with no previous use as a step-up risk trace', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('recipient_created', 100, {
          createdInCurrentSession: true,
          txCountToRecipient: 0,
        }),
      ],
      catalog(),
    );

    expect(result.recognitions).toEqual([
      expect.objectContaining({
        factor: 'new_recipient',
        reasonCodes: ['new_recipient_in_flow'],
        candidateScenarioIds: expect.arrayContaining(['NRC-03']),
      }),
      expect.objectContaining({
        factor: 'composite_risk_boost',
        reasonCodes: ['recipient_added_current_session_no_previous_use'],
        candidateScenarioIds: [],
      }),
    ]);
    expect(result.riskSignals.map((signal) => signal.kind)).toEqual([
      'new_recipient',
      'composite_risk_boost',
    ]);
  });

  it('recognizes NRC-11 new recipient with a small test-payment pattern as monitor risk signals', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('recipient_created', 100, {
          createdInCurrentSession: true,
          txCountToRecipient: 0,
        }),
        action('transfer_submitted', 500, {
          amount: 250,
          paymentPattern: 'test-payment',
        }),
      ],
      catalog(),
    );

    expect(result.recognitions).toEqual([
      expect.objectContaining({
        factor: 'new_recipient',
        reasonCodes: ['new_recipient_test_payment_pattern'],
        candidateScenarioIds: expect.arrayContaining(['NRC-11']),
      }),
      expect.objectContaining({
        factor: 'composite_risk_boost',
        contribution: 5,
        maxContribution: 5,
        reasonCodes: ['new_recipient_small_test_payment_pattern'],
        candidateScenarioIds: [],
      }),
    ]);
    expect(result.riskSignals).toEqual([
      expect.objectContaining({
        kind: 'new_recipient',
        contribution: undefined,
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 5,
        maxContribution: 5,
      }),
    ]);
  });

  it('recognizes NRC-04 layering from three new recipients with different amounts in one hour', () => {
    const service = new BankActionScenarioRecognizingService();

    const result = service.recognize(
      [
        action('recipient_created', 100, { recipientId: 'r-1', amount: 1000 }),
        action('recipient_created', 1000, { recipientId: 'r-2', amount: 2200 }),
        action('recipient_created', 3000, { recipientId: 'r-3', amount: 3600 }),
      ],
      catalog(),
    );

    expect(result.recognitions).toEqual([
      expect.objectContaining({
        factor: 'new_recipient',
        reasonCodes: ['new_recipient_layering_pattern'],
        candidateScenarioIds: expect.arrayContaining(['NRC-04']),
      }),
      expect.objectContaining({
        factor: 'recipient_velocity',
        reasonCodes: ['new_recipient_layering_pattern'],
      }),
      expect.objectContaining({
        factor: 'velocity_anomaly',
        reasonCodes: ['layering_different_amounts'],
      }),
    ]);
    expect(result.riskSignals.map((signal) => signal.kind)).toEqual([
      'new_recipient',
      'recipient_velocity',
      'velocity_anomaly',
    ]);
  });
});

function catalog() {
  return new ScenarioCatalogParsingService().parse(
    readFileSync(join(process.cwd(), 'prd', 'Scenarios_Catalog_v0.3.md'), 'utf8'),
  );
}

function action(kind: BankActionEntity['kind'], atMs: number, metadata?: Record<string, unknown>): BankActionEntity {
  return { kind, atMs, metadata };
}
