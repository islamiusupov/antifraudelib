import type { PhishingUrlFeatureVectorEntity } from '../../domain/entities/PhishingUrlFeatureVectorEntity';
import type { PhishingUrlInputEntity } from '../../domain/entities/PhishingUrlInputEntity';

const SUSPICIOUS_TOKENS = ['safe-account', 'secure-account', 'central-bank', 'verify', 'otp', 'cbr'];
const RISKY_TLDS = ['tk', 'ml', 'ga', 'cf', 'gq'];
const BANK_BRAND_TOKENS = ['bank', 'sber', 'tinkoff', 'vtb', 'mir', 'cbr'];

export class PhishingUrlFeatureVectorBuildingService {
  build(input: PhishingUrlInputEntity): PhishingUrlFeatureVectorEntity {
    const parsedUrl = this.parseUrl(input.url);
    const hostname = parsedUrl?.hostname.toLowerCase() ?? '';
    const normalizedUrl = input.url.toLowerCase();

    return {
      allowedDomainMatch: this.booleanFeature(this.isAllowedHostname(hostname, input.allowedDomains)),
      hasIpAddress: this.booleanFeature(this.hasIpAddress(hostname)),
      hasSuspiciousToken: this.booleanFeature(SUSPICIOUS_TOKENS.some((token) => normalizedUrl.includes(token))),
      hasRiskyTld: this.booleanFeature(this.hasRiskyTld(hostname)),
      hasPunycode: this.booleanFeature(hostname.includes('xn--')),
      hasAtSign: this.booleanFeature(normalizedUrl.includes('@')),
      hasManySubdomains: this.booleanFeature(this.countHostnameLabels(hostname) >= 4),
      isLongUrl: this.booleanFeature(input.url.length >= 120),
      hasBrandMimicry: this.booleanFeature(this.hasBrandMimicry(hostname)),
    };
  }

  private parseUrl(url: string): URL | undefined {
    try {
      return new URL(url);
    } catch {
      return undefined;
    }
  }

  private isAllowedHostname(hostname: string, allowedDomains: string[]): boolean {
    return allowedDomains.some((allowedDomain) => {
      const normalizedAllowedDomain = allowedDomain.toLowerCase();
      return hostname === normalizedAllowedDomain || hostname.endsWith(`.${normalizedAllowedDomain}`);
    });
  }

  private hasIpAddress(hostname: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  }

  private hasRiskyTld(hostname: string): boolean {
    const parts = hostname.split('.');
    const tld = parts[parts.length - 1] ?? '';
    return RISKY_TLDS.some((riskyTld) => riskyTld === tld);
  }

  private countHostnameLabels(hostname: string): number {
    if (hostname.length === 0) return 0;
    return hostname.split('.').length;
  }

  private hasBrandMimicry(hostname: string): boolean {
    return BANK_BRAND_TOKENS.some((brand) => hostname.includes(brand)) && /[-_]/.test(hostname);
  }

  private booleanFeature(value: boolean): number {
    return value ? 1 : 0;
  }
}
