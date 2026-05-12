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

  it('extracts warning dwell when confirmation is too fast', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('warning_shown', 1000),
        event('warning_confirmed', 1400),
      ]),
    ).toEqual([
      {
        kind: 'warning_dwell',
        detected: true,
        confidence: 0.9,
        reasonCodes: ['warning_dwell_too_short'],
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

  it('ignores malformed server factor events without a string factor metadata value', () => {
    const service = new DBankLiveFactorExtractingService();

    expect(
      service.extract([
        event('server_factor_observed', 100),
        event('server_factor_observed', 200, { factor: 123 }),
      ]),
    ).toEqual([]);
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
