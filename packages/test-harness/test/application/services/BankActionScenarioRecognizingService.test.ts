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
    ]);
    expect(result.riskSignals.map((signal) => signal.kind)).toEqual([
      'concurrent_media',
      'new_recipient',
      'warning_dwell',
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

  it.each([
    ['media_active', 'concurrent_media', ['concurrent_media_active']],
    ['recipient_created', 'new_recipient', ['new_recipient_in_flow']],
    ['recipient_pasted', 'copy_paste_recipient', ['copy_paste_recipient']],
    ['page_hidden', 'page_visibility', ['page_visibility_oscillation']],
    ['visual_challenge_started', 'visual_challenge', ['visual_challenge_started']],
    ['keystroke_anomaly_observed', 'keystroke_dynamics', ['keystroke_dynamics_anomaly']],
    ['pointer_anomaly_observed', 'pointer_pattern', ['pointer_pattern_anomaly']],
    ['rapid_scroll_observed', 'pointer_pattern', ['rapid_scroll_pattern']],
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
    ]);
    expect(result.riskSignals).toEqual([
      expect.objectContaining({
        kind: 'tls_fingerprint',
        source: 'live',
      }),
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
