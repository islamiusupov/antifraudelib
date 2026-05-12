import { describe, expect, it } from 'vitest';
import { PhishingUrlModelScoringService } from '../../../src/application/services/PhishingUrlModelScoringService';

describe('PhishingUrlModelScoringService', () => {
  it('scores suspicious URL features above the phishing threshold', () => {
    const service = new PhishingUrlModelScoringService();

    const result = service.score({
      allowedDomainMatch: 0,
      hasIpAddress: 0,
      hasSuspiciousToken: 1,
      hasRiskyTld: 0,
      hasPunycode: 0,
      hasAtSign: 0,
      hasManySubdomains: 0,
      isLongUrl: 0,
      hasBrandMimicry: 1,
    });

    expect(result).toMatchObject({
      modelId: 'urlbert-tiny-v4-fallback-v0',
      threshold: 0.65,
      score: 0.7311,
    });
  });

  it('suppresses trusted bank domains below the phishing threshold', () => {
    const service = new PhishingUrlModelScoringService();

    const result = service.score({
      allowedDomainMatch: 1,
      hasIpAddress: 0,
      hasSuspiciousToken: 1,
      hasRiskyTld: 0,
      hasPunycode: 0,
      hasAtSign: 0,
      hasManySubdomains: 0,
      isLongUrl: 0,
      hasBrandMimicry: 0,
    });

    expect(result.score).toBeLessThan(result.threshold);
  });
});
