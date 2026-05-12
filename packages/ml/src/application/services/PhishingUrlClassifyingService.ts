import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { PhishingUrlInputEntity } from '../../domain/entities/PhishingUrlInputEntity';

export class PhishingUrlClassifyingService {
  classify(input: PhishingUrlInputEntity): RiskSignalEntity {
    const hostname = this.hostname(input.url);
    if (hostname !== undefined && input.allowedDomains.includes(hostname)) {
      return this.inactive();
    }
    if (this.hasSuspiciousPattern(input.url)) {
      return {
        kind: 'phishing_url',
        detected: true,
        confidence: 1,
        reasonCodes: ['phishing_url_pattern'],
        source: 'live',
        metadata: {
          classifier: 'url_pattern',
        },
      };
    }
    return this.inactive();
  }

  private hostname(url: string): string | undefined {
    try {
      return new URL(url).hostname;
    } catch {
      return undefined;
    }
  }

  private hasSuspiciousPattern(url: string): boolean {
    const normalizedUrl = url.toLowerCase();
    return (
      normalizedUrl.includes('safe-account') ||
      normalizedUrl.includes('secure-account') ||
      normalizedUrl.includes('cbr') ||
      normalizedUrl.includes('central-bank')
    );
  }

  private inactive(): RiskSignalEntity {
    return {
      kind: 'phishing_url',
      detected: false,
      confidence: 0,
      reasonCodes: [],
      source: 'live',
    };
  }
}
