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
    ).toMatchObject({
      kind: 'phishing_url',
      detected: false,
      confidence: 0,
      reasonCodes: ['urlbert_benign_high_confidence'],
      source: 'live',
      metadata: {
        verdict: 'benign',
      },
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
    ).toMatchObject({
      kind: 'phishing_url',
      detected: false,
      confidence: 0,
      reasonCodes: ['urlbert_benign_high_confidence'],
      source: 'live',
      metadata: {
        verdict: 'benign',
      },
    });
  });

  it('emits a blocking URLBERT high-confidence phishing verdict', () => {
    const service = new PhishingUrlClassifyingService();
    const longPath = 'a'.repeat(130);

    expect(
      service.classifyMany({
        url: `https://secure-account-bank.xn--80ak6aa92e.tk/${longPath}?email=a@b.test`,
        allowedDomains: ['bank.example'],
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'phishing_url',
        detected: true,
        reasonCodes: expect.arrayContaining(['urlbert_phishing_high_confidence']),
        metadata: expect.objectContaining({
          verdict: 'phishing',
          modelScore: expect.any(Number),
        }),
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 45,
        maxContribution: 45,
        reasonCodes: ['phishing_url_block_floor'],
      }),
    ]);
  });

  it('emits an inactive URLBERT high-confidence benign verdict', () => {
    const service = new PhishingUrlClassifyingService();

    expect(
      service.classify({
        url: 'https://sberbank.ru/online',
        allowedDomains: ['sberbank.ru'],
      }),
    ).toMatchObject({
      kind: 'phishing_url',
      detected: false,
      confidence: 0,
      reasonCodes: ['urlbert_benign_high_confidence'],
      metadata: {
        verdict: 'benign',
      },
    });
  });
});
