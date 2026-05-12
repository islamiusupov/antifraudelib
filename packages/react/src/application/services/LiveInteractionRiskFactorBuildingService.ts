import {
  DevEnvironmentSignalBuildingService,
  FactorContributionBuildingService,
  KeystrokeDynamicsSignalBuildingService,
  PageVisibilitySignalBuildingService,
  PhishingUrlSignalBuildingService,
  PointerPatternSignalBuildingService,
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
    private readonly keystrokeDynamicsSignalBuildingService = new KeystrokeDynamicsSignalBuildingService(),
    private readonly devEnvironmentSignalBuildingService = new DevEnvironmentSignalBuildingService(),
    private readonly pointerPatternSignalBuildingService = new PointerPatternSignalBuildingService(),
    private readonly phishingUrlSignalBuildingService = new PhishingUrlSignalBuildingService(),
    private readonly pageVisibilitySignalBuildingService = new PageVisibilitySignalBuildingService(),
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
    signals.push(...this.pageVisibilitySignalBuildingService.build(
      this.pageVisibilityReasonCodes(events),
      this.pageVisibilityMetadata(events),
    ));
    signals.push(...this.pointerPatternSignalBuildingService.build(
      this.pointerReasonCodes(events),
      this.pointerMetadata(events),
    ));
    signals.push(...this.keystrokeDynamicsSignalBuildingService.build(
      this.keystrokeReasonCodes(events),
      this.keystrokeMetadata(events),
    ));
    this.pushIfPresent(signals, events, 'phishing_text_observed', 'phishing_text_dom', ['phishing_text_dom']);
    signals.push(...this.phishingUrlSignalBuildingService.build(
      this.eventReasonCodesForKind(events, 'phishing_url_observed', 'phishing_url_pattern'),
      this.eventMetadata(events, 'phishing_url_observed'),
    ));
    this.pushIfPresent(signals, events, 'native_tampering_observed', 'native_tampering', ['native_tampering']);
    signals.push(...this.devEnvironmentSignalBuildingService.build(
      this.eventReasonCodesForKind(events, 'dev_environment_observed', 'dev_environment'),
      this.eventMetadata(events, 'dev_environment_observed'),
    ));
    this.pushIfPresent(signals, events, 'client_environment_observed', 'client_environment', ['client_environment'], 0.8);
    this.pushIfPresent(signals, events, 'environment_conflict_observed', 'environment_conflicts', ['environment_conflicts'], 0.9);
    this.pushReasonedIfPresent(signals, events, 'device_fingerprint_observed', 'device_fingerprint', 'device_fingerprint');

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
    signals.push(this.signal(factorKind, reasonCodes, confidence, this.eventMetadata(events, eventKind)));
  }

  private pushReasonedIfPresent(
    signals: RiskSignalEntity[],
    events: LiveInteractionEventEntity[],
    eventKind: LiveInteractionEventEntity['kind'],
    factorKind: RiskSignalEntity['kind'],
    fallbackReasonCode: string,
    confidence = 1,
  ): void {
    if (!this.has(events, eventKind)) return;
    signals.push(this.signal(
      factorKind,
      this.eventReasonCodesForKind(events, eventKind, fallbackReasonCode),
      confidence,
      this.eventMetadata(events, eventKind),
    ));
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

  private keystrokeReasonCodes(events: LiveInteractionEventEntity[]): string[] {
    return events
      .filter((event) => event.kind === 'keystroke_anomaly_observed')
      .reduce<string[]>((reasonCodes, event) => [
        ...reasonCodes,
        ...this.eventReasonCodes(event.metadata, 'keystroke_dynamics_anomaly'),
      ], []);
  }

  private keystrokeMetadata(events: LiveInteractionEventEntity[]): Record<string, unknown> {
    return this.eventMetadata(events, 'keystroke_anomaly_observed');
  }

  private pageVisibilityReasonCodes(events: LiveInteractionEventEntity[]): string[] {
    return this.pageVisibilityEvents(events)
      .reduce<string[]>((reasonCodes, event) => [
        ...reasonCodes,
        ...this.eventReasonCodes(event.metadata, ''),
      ], []);
  }

  private pageVisibilityMetadata(events: LiveInteractionEventEntity[]): Record<string, unknown> {
    const pageVisibilityEvents = this.pageVisibilityEvents(events);
    const observations = pageVisibilityEvents
      .filter((event) => this.isMetadataRecord(event.metadata))
      .map((event) => event.metadata as Record<string, unknown>);
    const latestMetadata = observations.length > 0 ? observations[observations.length - 1] : {};
    return {
      ...latestMetadata,
      eventCount: pageVisibilityEvents.length,
      hiddenCount: this.count(events, 'page_hidden'),
      visibleCount: this.count(events, 'page_visible'),
      observedCount: this.count(events, 'page_visibility_observed'),
      observations,
    };
  }

  private pageVisibilityEvents(events: LiveInteractionEventEntity[]): LiveInteractionEventEntity[] {
    return events.filter((event) => (
      event.kind === 'page_hidden' ||
      event.kind === 'page_visible' ||
      event.kind === 'page_visibility_observed'
    ));
  }

  private pointerReasonCodes(events: LiveInteractionEventEntity[]): string[] {
    return [
      ...this.eventReasonCodesForKind(events, 'pointer_anomaly_observed', 'pointer_pattern_anomaly'),
      ...this.eventReasonCodesForKind(events, 'rapid_scroll_observed', 'rapid_scroll_pattern'),
      ...this.eventReasonCodesForKind(events, 'click_burst_observed', 'click_burst_pattern'),
    ];
  }

  private pointerMetadata(events: LiveInteractionEventEntity[]): Record<string, unknown> {
    const pointerEvents = events.filter((event) => (
      event.kind === 'pointer_anomaly_observed' ||
      event.kind === 'rapid_scroll_observed' ||
      event.kind === 'click_burst_observed'
    ));
    const observations = pointerEvents
      .filter((event) => this.isMetadataRecord(event.metadata))
      .map((event) => event.metadata as Record<string, unknown>);
    const latestMetadata = observations.length > 0 ? observations[observations.length - 1] : {};
    return {
      ...latestMetadata,
      eventCount: pointerEvents.length,
      observations,
    };
  }

  private eventReasonCodesForKind(
    events: LiveInteractionEventEntity[],
    kind: LiveInteractionEventEntity['kind'],
    fallback: string,
  ): string[] {
    return events
      .filter((event) => event.kind === kind)
      .reduce<string[]>((reasonCodes, event) => [
        ...reasonCodes,
        ...this.eventReasonCodes(event.metadata, fallback),
      ], []);
  }

  private eventMetadata(
    events: LiveInteractionEventEntity[],
    kind: LiveInteractionEventEntity['kind'],
  ): Record<string, unknown> {
    const observations = events
      .filter((event) => event.kind === kind && this.isMetadataRecord(event.metadata))
      .map((event) => event.metadata as Record<string, unknown>);
    const latestMetadata = observations.length > 0 ? observations[observations.length - 1] : {};
    return {
      ...latestMetadata,
      eventCount: this.count(events, kind),
      observations,
    };
  }

  private eventReasonCodes(metadata: Record<string, unknown> | undefined, fallback: string): string[] {
    const reason = metadata?.reason;
    if (typeof reason === 'string' && reason.trim() !== '') return [reason];
    const reasonCodes = metadata?.reasonCodes;
    if (Array.isArray(reasonCodes)) {
      const validReasonCodes = reasonCodes.filter((value): value is string => (
        typeof value === 'string' && value.trim() !== ''
      ));
      if (validReasonCodes.length > 0) return validReasonCodes;
    }
    return [fallback];
  }

  private isMetadataRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private has(events: LiveInteractionEventEntity[], kind: LiveInteractionEventEntity['kind']): boolean {
    return events.some((event) => event.kind === kind);
  }

  private count(events: LiveInteractionEventEntity[], kind: LiveInteractionEventEntity['kind']): number {
    return events.filter((event) => event.kind === kind).length;
  }
}
