import { describe, expect, it } from 'vitest';
import { DBankBridgeMessageParsingService } from '../../../src/application/services/DBankBridgeMessageParsingService';

describe('DBankBridgeMessageParsingService', () => {
  it('parses a valid D-bank bridge event', () => {
    const service = new DBankBridgeMessageParsingService();

    expect(
      service.parse({
        source: 'd-bank',
        type: 'd-bank:event',
        payload: {
          kind: 'recipient_pasted',
          atMs: 120,
          metadata: { field: 'recipient' },
        },
      }),
    ).toEqual({
      source: 'd-bank',
      type: 'd-bank:event',
      payload: {
        kind: 'recipient_pasted',
        atMs: 120,
        metadata: { field: 'recipient' },
      },
    });
  });

  it('ignores unrelated or malformed messages', () => {
    const service = new DBankBridgeMessageParsingService();

    expect(service.parse({ source: 'other', type: 'd-bank:event', payload: {} })).toBeNull();
    expect(service.parse({ source: 'd-bank', type: 'other', payload: {} })).toBeNull();
    expect(service.parse({ source: 'd-bank', type: 'd-bank:event', payload: { kind: 'recipient_pasted' } })).toBeNull();
    expect(service.parse({ source: 'd-bank', type: 'd-bank:event', payload: { kind: 'unknown', atMs: 1 } })).toBeNull();
    expect(service.parse({ source: 'd-bank', type: 'd-bank:event', payload: { kind: 'recipient_pasted', atMs: Number.NaN } })).toBeNull();
    expect(service.parse({ source: 'd-bank', type: 'd-bank:event', payload: { kind: 'recipient_pasted', atMs: 1, metadata: [] } })).toBeNull();
    expect(service.parse(null)).toBeNull();
  });

  it.each([
    'bank_opened',
    'transfer_opened',
    'recipient_pasted',
    'amount_pasted',
    'recipient_created',
    'transfer_submitted',
    'media_active',
    'warning_shown',
    'warning_confirmed',
    'warning_scrolled',
    'form_fill_order_observed',
    'page_hidden',
    'page_visible',
    'visual_challenge_started',
    'keystroke_anomaly_observed',
    'pointer_anomaly_observed',
    'rapid_scroll_observed',
    'native_tampering_observed',
    'dev_environment_observed',
    'bot_detected',
    'phishing_text_observed',
    'phishing_url_observed',
    'token_injection_observed',
    'client_environment_observed',
    'environment_conflict_observed',
    'device_fingerprint_observed',
    'server_factor_observed',
  ] as const)('accepts bridge event kind %s', (kind) => {
    const service = new DBankBridgeMessageParsingService();

    expect(
      service.parse({
        source: 'd-bank',
        type: 'd-bank:event',
        payload: {
          kind,
          atMs: 1,
        },
      })?.payload.kind,
    ).toBe(kind);
  });
});
