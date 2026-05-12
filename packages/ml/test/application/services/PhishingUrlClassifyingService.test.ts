import { describe, expect, it } from 'vitest';
import { PhishingUrlClassifyingService } from '../../../src/application/services/PhishingUrlClassifyingService';

describe('PhishingUrlClassifyingService', () => {
  it('returns an inactive signal for allowed bank domains', () => {
    const service = new PhishingUrlClassifyingService();

    expect(
      service.classify({
        url: 'https://bank.example/payments',
        allowedDomains: ['bank.example'],
      }),
    ).toEqual({
      kind: 'phishing_url',
      detected: false,
      confidence: 0,
      reasonCodes: [],
      source: 'live',
    });
  });

  it('detects suspicious safe-account phishing URL fallback patterns', () => {
    const service = new PhishingUrlClassifyingService();

    expect(
      service.classify({
        url: 'https://secure-safe-account-cbr.example/login',
        allowedDomains: ['bank.example'],
      }),
    ).toMatchObject({
      kind: 'phishing_url',
      detected: true,
      confidence: 0.7311,
      reasonCodes: ['phishing_url_pattern'],
      source: 'live',
      metadata: {
        classifier: 'urlbert-tiny-v4-fallback-v0',
        modelScore: 0.7311,
      },
    });
  });

  it('keeps suspicious text inactive when it belongs to an allowlisted bank domain', () => {
    const service = new PhishingUrlClassifyingService();

    expect(
      service.classify({
        url: 'https://secure-account.bank.example/login',
        allowedDomains: ['bank.example'],
      }),
    ).toEqual({
      kind: 'phishing_url',
      detected: false,
      confidence: 0,
      reasonCodes: [],
      source: 'live',
    });
  });
});
