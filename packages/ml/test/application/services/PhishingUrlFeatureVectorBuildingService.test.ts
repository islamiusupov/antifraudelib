import { describe, expect, it } from 'vitest';
import { PhishingUrlFeatureVectorBuildingService } from '../../../src/application/services/PhishingUrlFeatureVectorBuildingService';

describe('PhishingUrlFeatureVectorBuildingService', () => {
  it('builds URL risk features without exposing the raw URL as model metadata', () => {
    const service = new PhishingUrlFeatureVectorBuildingService();

    expect(
      service.build({
        url: 'https://secure-safe-account-cbr.example/login',
        allowedDomains: ['bank.example'],
      }),
    ).toEqual({
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
  });

  it('marks exact and subdomain allowlist matches', () => {
    const service = new PhishingUrlFeatureVectorBuildingService();

    expect(
      service.build({
        url: 'https://pay.bank.example/transfers',
        allowedDomains: ['bank.example'],
      }).allowedDomainMatch,
    ).toBe(1);
  });
});
