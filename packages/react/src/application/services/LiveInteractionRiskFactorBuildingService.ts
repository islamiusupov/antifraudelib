import { FactorContributionBuildingService, type RiskFactorEntity, type RiskSignalEntity } from '@deepcode/antifraud-core';
import type { LiveInteractionEventEntity } from '../../domain/live/entities/LiveInteractionEventEntity';

export class LiveInteractionRiskFactorBuildingService {
  constructor(private readonly factorContributionBuildingService = new FactorContributionBuildingService()) {}

  build(events: LiveInteractionEventEntity[]): RiskFactorEntity[] {
    return this.factorContributionBuildingService.buildMany(this.signals(events));
  }

  private signals(events: LiveInteractionEventEntity[]): RiskSignalEntity[] {
    const signals: RiskSignalEntity[] = [];

    this.pushIfPresent(signals, events, 'recipient_pasted', 'copy_paste_recipient', ['copy_paste_recipient']);
    this.pushIfPresent(signals, events, 'amount_pasted', 'copy_paste_amount', ['copy_paste_amount']);
    if (this.hasFastWarningConfirmation(events)) {
      signals.push(this.signal('warning_dwell', ['warning_dwell_too_short'], 0.9));
    }
    if (this.has(events, 'page_hidden') && this.has(events, 'page_visible')) {
      signals.push(this.signal('page_visibility', ['page_visibility_oscillation'], 0.8));
    }
    const pointerPatternReasonCodes = [
      ...(this.has(events, 'pointer_anomaly_observed') ? ['pointer_pattern_anomaly'] : []),
      ...(this.has(events, 'rapid_scroll_observed') ? ['rapid_scroll_pattern'] : []),
    ];
    if (pointerPatternReasonCodes.length > 0) {
      signals.push(this.signal('pointer_pattern', pointerPatternReasonCodes, 0.8));
    }
    this.pushIfPresent(signals, events, 'keystroke_anomaly_observed', 'keystroke_dynamics', ['keystroke_dynamics_anomaly'], 0.8);
    this.pushIfPresent(signals, events, 'phishing_text_observed', 'phishing_text_dom', ['phishing_text_dom']);
    this.pushIfPresent(signals, events, 'native_tampering_observed', 'native_tampering', ['native_tampering']);
    this.pushIfPresent(signals, events, 'dev_environment_observed', 'dev_environment', ['dev_environment']);
    this.pushIfPresent(signals, events, 'client_environment_observed', 'client_environment', ['client_environment'], 0.8);
    this.pushIfPresent(signals, events, 'environment_conflict_observed', 'environment_conflicts', ['environment_conflicts'], 0.9);

    return signals;
  }

  private pushIfPresent(
    signals: RiskSignalEntity[],
    events: LiveInteractionEventEntity[],
    eventKind: LiveInteractionEventEntity['kind'],
    factorKind: RiskSignalEntity['kind'],
    reasonCodes: string[],
    confidence = 1,
  ): void {
    if (!this.has(events, eventKind)) return;
    signals.push(this.signal(factorKind, reasonCodes, confidence, { eventCount: this.count(events, eventKind) }));
  }

  private signal(
    kind: RiskSignalEntity['kind'],
    reasonCodes: string[],
    confidence: number,
    metadata?: Record<string, unknown>,
  ): RiskSignalEntity {
    return {
      kind,
      detected: true,
      confidence,
      reasonCodes,
      source: 'live',
      metadata,
    };
  }

  private hasFastWarningConfirmation(events: LiveInteractionEventEntity[]): boolean {
    const warningShown = events.find((event) => event.kind === 'warning_shown');
    const warningConfirmed = events.find((event) => event.kind === 'warning_confirmed');
    if (warningShown === undefined || warningConfirmed === undefined) return false;
    return warningConfirmed.atMs - warningShown.atMs < 1000;
  }

  private has(events: LiveInteractionEventEntity[], kind: LiveInteractionEventEntity['kind']): boolean {
    return events.some((event) => event.kind === kind);
  }

  private count(events: LiveInteractionEventEntity[], kind: LiveInteractionEventEntity['kind']): number {
    return events.filter((event) => event.kind === kind).length;
  }
}
