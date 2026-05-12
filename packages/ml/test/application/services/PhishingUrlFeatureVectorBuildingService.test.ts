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

  it('flags IP hosts, risky TLDs, punycode, at-signs, many subdomains, and long URLs', () => {
    const service = new PhishingUrlFeatureVectorBuildingService();
    const longPath = 'a'.repeat(130);

    expect(
      service.build({
        url: `https://user@xn--80akf.pay.safe.account.bank.tk/${longPath}`,
        allowedDomains: ['bank.example'],
      }),
    ).toMatchObject({
      hasRiskyTld: 1,
      hasPunycode: 1,
      hasAtSign: 1,
      hasManySubdomains: 1,
      isLongUrl: 1,
      hasBrandMimicry: 1,
    });

    expect(
      service.build({
        url: 'https://127.0.0.1/login',
        allowedDomains: [],
      }).hasIpAddress,
    ).toBe(1);
  });

  it('returns zeroed URL features for malformed URLs except raw token checks', () => {
    const service = new PhishingUrlFeatureVectorBuildingService();

    expect(
      service.build({
        url: 'not a url with secure-account token',
        allowedDomains: ['bank.example'],
      }),
    ).toMatchObject({
      allowedDomainMatch: 0,
      hasIpAddress: 0,
      hasSuspiciousToken: 1,
      hasRiskyTld: 0,
      hasPunycode: 0,
      hasAtSign: 0,
      hasManySubdomains: 0,
      hasBrandMimicry: 0,
    });
  });
});
