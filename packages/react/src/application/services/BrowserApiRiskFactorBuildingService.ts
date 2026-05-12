import { FactorContributionBuildingService, type RiskFactorEntity, type RiskSignalEntity } from '@deepcode/antifraud-core';
import type { BrowserApiInterceptionEventEntity } from '../../domain/browser/entities/BrowserApiInterceptionEventEntity';

export class BrowserApiRiskFactorBuildingService {
  constructor(private readonly factorContributionBuildingService = new FactorContributionBuildingService()) {}

  build(events: BrowserApiInterceptionEventEntity[]): RiskFactorEntity[] {
    return this.factorContributionBuildingService.buildMany(this.signals(events));
  }

  private signals(events: BrowserApiInterceptionEventEntity[]): RiskSignalEntity[] {
    const signals: RiskSignalEntity[] = [];

    if (events.some((event) => event.kind === 'media_requested')) {
      signals.push({
        kind: 'concurrent_media',
        detected: true,
        confidence: 1,
        reasonCodes: ['layer2_media_request'],
        source: 'live',
        metadata: {
          eventCount: this.count(events, 'media_requested'),
        },
      });
    }

    const clipboardOtpEvents = events.filter((event) =>
      (event.kind === 'clipboard_read' || event.kind === 'clipboard_write') &&
      event.metadata.hasOtpPattern === true,
    );
    if (clipboardOtpEvents.length > 0) {
      signals.push({
        kind: 'clipboard_otp_pattern',
        detected: true,
        confidence: 1,
        reasonCodes: ['clipboard_otp_pattern'],
        source: 'live',
        metadata: {
          eventCount: clipboardOtpEvents.length,
        },
      });
    }

    const clipboardReadEvents = events.filter((event) => event.kind === 'clipboard_read');
    if (clipboardReadEvents.length > 0) {
      signals.push({
        kind: 'programmatic_clipboard_read',
        detected: true,
        confidence: 1,
        reasonCodes: ['programmatic_clipboard_read'],
        source: 'live',
        metadata: {
          eventCount: clipboardReadEvents.length,
        },
      });
    }

    const networkTokenEvents = events.filter((event) =>
      (event.kind === 'fetch_requested' || event.kind === 'xhr_requested') &&
      event.allowed === false &&
      event.metadata.hasTokenLikePayload === true,
    );
    if (networkTokenEvents.length > 0) {
      signals.push({
        kind: 'recent_token_injection',
        detected: true,
        confidence: 1,
        reasonCodes: ['network_token_exfiltration'],
        source: 'live',
        metadata: {
          eventCount: networkTokenEvents.length,
        },
      });
    }

    return signals;
  }

  private count(events: BrowserApiInterceptionEventEntity[], kind: BrowserApiInterceptionEventEntity['kind']): number {
    return events.filter((event) => event.kind === kind).length;
  }
}
