import {
  FactorContributionBuildingService,
  WarningDwellSignalBuildingService,
  type RiskFactorEntity,
  type RiskSignalEntity,
  type WarningDwellObservationEntity,
} from '@deepcode/antifraud-core';
import type { LiveInteractionEventEntity } from '../../domain/live/entities/LiveInteractionEventEntity';

export class LiveInteractionRiskFactorBuildingService {
  constructor(
    private readonly factorContributionBuildingService = new FactorContributionBuildingService(),
    private readonly warningDwellSignalBuildingService = new WarningDwellSignalBuildingService(),
  ) {}

  build(events: LiveInteractionEventEntity[]): RiskFactorEntity[] {
    return this.factorContributionBuildingService.buildMany(this.signals(events));
  }

  private signals(events: LiveInteractionEventEntity[]): RiskSignalEntity[] {
    const signals: RiskSignalEntity[] = [];

    this.pushIfPresent(signals, events, 'recipient_pasted', 'copy_paste_recipient', ['copy_paste_recipient']);
    this.pushIfPresent(signals, events, 'amount_pasted', 'copy_paste_amount', ['copy_paste_amount']);
    this.pushIfPresent(signals, events, 'form_fill_order_observed', 'form_fill_order', ['multi_field_recipient_bulk_fill']);
    signals.push(...this.warningDwellSignalBuildingService.build(this.warningDwellObservations(events)));
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

  private warningDwellObservations(
    events: LiveInteractionEventEntity[],
  ): WarningDwellObservationEntity[] {
    return events.filter((event): event is WarningDwellObservationEntity => (
      event.kind === 'warning_shown' ||
      event.kind === 'warning_confirmed' ||
      event.kind === 'warning_scrolled'
    ));
  }

  private has(events: LiveInteractionEventEntity[], kind: LiveInteractionEventEntity['kind']): boolean {
    return events.some((event) => event.kind === kind);
  }

  private count(events: LiveInteractionEventEntity[], kind: LiveInteractionEventEntity['kind']): number {
    return events.filter((event) => event.kind === kind).length;
  }
}
