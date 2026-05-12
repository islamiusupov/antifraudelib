import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { DBankObservedEventEntity } from '../../domain/entities/DBankObservedEventEntity';

export class DBankLiveFactorExtractingService {
  extract(events: DBankObservedEventEntity[]): RiskSignalEntity[] {
    const signals: RiskSignalEntity[] = [];

    if (this.hasEvent(events, 'recipient_pasted')) {
      signals.push({
        kind: 'copy_paste_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['copy_paste_recipient'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'media_active')) {
      signals.push({
        kind: 'concurrent_media',
        detected: true,
        confidence: 1,
        reasonCodes: ['concurrent_media_active'],
        source: 'live',
      });
    }
    if (this.hasFastWarningConfirmation(events)) {
      signals.push({
        kind: 'warning_dwell',
        detected: true,
        confidence: 0.9,
        reasonCodes: ['warning_dwell_too_short'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'page_hidden') && this.hasEvent(events, 'page_visible')) {
      signals.push({
        kind: 'page_visibility',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['page_visibility_oscillation'],
        source: 'live',
      });
    }

    return signals;
  }

  private hasEvent(events: DBankObservedEventEntity[], kind: DBankObservedEventEntity['kind']): boolean {
    return events.some((event) => event.kind === kind);
  }

  private hasFastWarningConfirmation(events: DBankObservedEventEntity[]): boolean {
    const warningShown = events.find((event) => event.kind === 'warning_shown');
    const warningConfirmed = events.find((event) => event.kind === 'warning_confirmed');
    if (warningShown === undefined || warningConfirmed === undefined) return false;
    return warningConfirmed.atMs - warningShown.atMs < 1000;
  }
}
