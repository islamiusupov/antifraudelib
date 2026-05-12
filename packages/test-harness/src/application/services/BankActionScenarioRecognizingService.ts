import {
  DevEnvironmentSignalBuildingService,
  KeystrokeDynamicsSignalBuildingService,
  PageVisibilitySignalBuildingService,
  PhishingUrlSignalBuildingService,
  PointerPatternSignalBuildingService,
  WarningDwellSignalBuildingService,
  type RiskFactorKind,
  type RiskSignalEntity,
  type WarningDwellObservationEntity,
} from '@deepcode/antifraud-core';
import type { ParsedScenarioCatalogEntity } from '@deepcode/antifraud-scenario-catalog';
import type { BankActionEntity } from '../../domain/harness/entities/BankActionEntity';
import type { ScenarioRecognitionEntity } from '../../domain/harness/entities/ScenarioRecognitionEntity';
import type { ScenarioRecognitionResultEntity } from '../../domain/harness/entities/ScenarioRecognitionResultEntity';
import { CompositeScenarioRecognizingService } from './CompositeScenarioRecognizingService';

const LAYERING_RECIPIENT_COUNT = 3;
const LAYERING_WINDOW_MS = 60 * 60 * 1000;
const SMALL_TEST_PAYMENT_AMOUNT_LIMIT = 500;
const SMALL_TEST_PAYMENT_MONITOR_BOOST = 5;
const TEST_PAYMENT_TEXT_PATTERN = /(?:test[-_\s]?payment|probe|verification|micro[-_\s]?transfer|trial[-_\s]?payment)/i;

export class BankActionScenarioRecognizingService {
  constructor(
    private readonly compositeScenarioRecognizingService = new CompositeScenarioRecognizingService(),
    private readonly warningDwellSignalBuildingService = new WarningDwellSignalBuildingService(),
    private readonly keystrokeDynamicsSignalBuildingService = new KeystrokeDynamicsSignalBuildingService(),
    private readonly devEnvironmentSignalBuildingService = new DevEnvironmentSignalBuildingService(),
    private readonly pointerPatternSignalBuildingService = new PointerPatternSignalBuildingService(),
    private readonly phishingUrlSignalBuildingService = new PhishingUrlSignalBuildingService(),
    private readonly pageVisibilitySignalBuildingService = new PageVisibilitySignalBuildingService(),
  ) {}

  recognize(actions: BankActionEntity[], catalog: ParsedScenarioCatalogEntity): ScenarioRecognitionResultEntity {
    const recognitions = this.recognizeFactors(actions, catalog);
    const compositeRecognitions = this.compositeScenarioRecognizingService.recognize(recognitions, catalog);

    return {
      status: recognitions.length > 0 || compositeRecognitions.length > 0 ? 'recognized' : 'no_match',
      target: 'd-bank',
      recognitions,
      compositeRecognitions,
      riskSignals: recognitions.map((recognition) => this.toRiskSignal(recognition)),
    };
  }

  private recognizeFactors(
    actions: BankActionEntity[],
    catalog: ParsedScenarioCatalogEntity,
  ): ScenarioRecognitionEntity[] {
    const recognitions: ScenarioRecognitionEntity[] = [];
    const hasNewRecipientLayeringPattern = this.hasNewRecipientLayeringPattern(actions);
    const smallTestPaymentAction = this.findSmallTestPaymentAction(actions);
    const hasSmallTestPaymentPattern = smallTestPaymentAction !== undefined;

    if (this.hasAction(actions, 'media_active')) {
      recognitions.push(this.createRecognition('concurrent_media', 1, ['concurrent_media_active'], catalog));
    }
    if (this.hasAction(actions, 'recipient_created')) {
      recognitions.push(
        this.createRecognition(
          'new_recipient',
          1,
          this.newRecipientReasonCodes(hasNewRecipientLayeringPattern, hasSmallTestPaymentPattern),
          catalog,
        ),
      );
      if (this.hasCurrentSessionUnusedRecipient(actions) && !hasSmallTestPaymentPattern) {
        recognitions.push(
          this.createRecognition(
            'composite_risk_boost',
            1,
            ['recipient_added_current_session_no_previous_use'],
            catalog,
          ),
        );
      }
      if (hasSmallTestPaymentPattern && !hasNewRecipientLayeringPattern) {
        recognitions.push(
          this.createRecognition(
            'composite_risk_boost',
            1,
            ['new_recipient_small_test_payment_pattern'],
            catalog,
            {
              contribution: SMALL_TEST_PAYMENT_MONITOR_BOOST,
              maxContribution: SMALL_TEST_PAYMENT_MONITOR_BOOST,
              metadata: smallTestPaymentAction.metadata,
            },
          ),
        );
      }
    }
    if (hasNewRecipientLayeringPattern) {
      recognitions.push(
        this.createRecognition('recipient_velocity', 1, ['new_recipient_layering_pattern'], catalog),
        this.createRecognition('velocity_anomaly', 1, ['layering_different_amounts'], catalog),
      );
    }
    if (this.hasAction(actions, 'recipient_pasted')) {
      recognitions.push(this.createRecognition(
        'copy_paste_recipient',
        1,
        ['copy_paste_recipient'],
        catalog,
        { metadata: this.optionalActionMetadata(actions, 'recipient_pasted') },
      ));
    }
    if (this.hasAction(actions, 'amount_pasted')) {
      recognitions.push(this.createRecognition(
        'copy_paste_amount',
        1,
        ['copy_paste_amount'],
        catalog,
        { metadata: this.optionalActionMetadata(actions, 'amount_pasted') },
      ));
    }
    recognitions.push(...this.warningDwellRecognitions(actions, catalog));
    if (this.hasAction(actions, 'form_fill_order_observed')) {
      recognitions.push(this.createRecognition('form_fill_order', 1, ['multi_field_recipient_bulk_fill'], catalog));
    }
    recognitions.push(...this.pageVisibilityRecognitions(actions, catalog));
    if (this.hasAction(actions, 'visual_challenge_started')) {
      recognitions.push(this.createRecognition('visual_challenge', 1, ['visual_challenge_started'], catalog));
    }
    recognitions.push(...this.keystrokeDynamicsRecognitions(actions, catalog));
    recognitions.push(...this.pointerPatternRecognitions(actions, catalog));
    if (this.hasAction(actions, 'screen_sharing_observed')) {
      recognitions.push(this.createRecognition(
        'screen_sharing',
        1,
        this.eventReasonCodes(actions, 'screen_sharing_observed', 'screen_sharing_heuristic'),
        catalog,
        { metadata: this.actionMetadata(actions, 'screen_sharing_observed') },
      ));
    }
    if (this.hasAction(actions, 'native_tampering_observed')) {
      recognitions.push(this.createRecognition('native_tampering', 1, ['native_tampering'], catalog));
    }
    recognitions.push(...this.devEnvironmentRecognitions(actions, catalog));
    if (this.hasAction(actions, 'bot_detected')) {
      recognitions.push(this.createRecognition('bot_detection', 1, ['bot_detection'], catalog));
    }
    if (this.hasAction(actions, 'phishing_text_observed')) {
      recognitions.push(this.createRecognition('phishing_text_dom', 1, ['phishing_text_dom'], catalog));
    }
    recognitions.push(...this.phishingUrlRecognitions(actions, catalog));
    if (this.hasAction(actions, 'token_injection_observed')) {
      recognitions.push(this.createRecognition('recent_token_injection', 1, ['recent_token_injection'], catalog));
    }
    if (this.hasAction(actions, 'client_environment_observed')) {
      recognitions.push(this.createRecognition('client_environment', 0.8, ['client_environment'], catalog));
    }
    if (this.hasAction(actions, 'environment_conflict_observed')) {
      recognitions.push(this.createRecognition('environment_conflicts', 0.9, ['environment_conflicts'], catalog));
    }
    if (this.hasAction(actions, 'device_fingerprint_observed')) {
      recognitions.push(this.createRecognition(
        'device_fingerprint',
        1,
        this.eventReasonCodes(actions, 'device_fingerprint_observed', 'device_fingerprint'),
        catalog,
        { metadata: this.optionalActionMetadata(actions, 'device_fingerprint_observed') },
      ));
    }

    const serverFactorActions = actions.filter((action) => action.kind === 'server_factor_observed');
    serverFactorActions.forEach((action) => {
      const factor = action.metadata?.factor;
      if (typeof factor !== 'string') return;
      recognitions.push(
        this.createRecognition(
          factor,
          1,
          this.serverFactorReasonCodes(factor, action.metadata),
          catalog,
          { metadata: action.metadata },
        ),
      );
    });

    return recognitions;
  }

  private createRecognition(
    factor: RiskFactorKind,
    confidence: number,
    reasonCodes: string[],
    catalog: ParsedScenarioCatalogEntity,
    options: Pick<ScenarioRecognitionEntity, 'contribution' | 'maxContribution' | 'metadata'> = {},
  ): ScenarioRecognitionEntity {
    const candidates = catalog.scenarios.filter((scenario) => scenario.factor === factor);
    return {
      factor,
      confidence,
      contribution: options.contribution,
      maxContribution: options.maxContribution,
      reasonCodes,
      candidateScenarioIds: candidates.map((scenario) => scenario.id),
      expectedVerdicts: this.unique(candidates.map((scenario) => scenario.normalizedVerdict)),
      metadata: options.metadata,
    };
  }

  private toRiskSignal(recognition: ScenarioRecognitionEntity): RiskSignalEntity {
    return {
      kind: recognition.factor,
      detected: true,
      confidence: recognition.confidence,
      contribution: recognition.contribution,
      maxContribution: recognition.maxContribution,
      reasonCodes: recognition.reasonCodes,
      source: 'live',
      metadata: recognition.metadata,
    };
  }

  private hasAction(actions: BankActionEntity[], kind: BankActionEntity['kind']): boolean {
    return actions.some((action) => action.kind === kind);
  }

  private newRecipientReasonCodes(
    hasNewRecipientLayeringPattern: boolean,
    hasSmallTestPaymentPattern: boolean,
  ): string[] {
    if (hasNewRecipientLayeringPattern) return ['new_recipient_layering_pattern'];
    if (hasSmallTestPaymentPattern) return ['new_recipient_test_payment_pattern'];
    return ['new_recipient_in_flow'];
  }

  private hasCurrentSessionUnusedRecipient(actions: BankActionEntity[]): boolean {
    return actions
      .filter((action) => action.kind === 'recipient_created')
      .some((action) => this.isCurrentSessionUnusedRecipient(action.metadata));
  }

  private isCurrentSessionUnusedRecipient(metadata: BankActionEntity['metadata']): boolean {
    return this.isCurrentSessionRecipient(metadata) && this.hasNoPreviousRecipientUse(metadata);
  }

  private isCurrentSessionRecipient(metadata: BankActionEntity['metadata']): boolean {
    return (
      metadata?.createdInCurrentSession === true ||
      metadata?.addedInCurrentSession === true ||
      metadata?.currentSessionRecipient === true
    );
  }

  private hasNoPreviousRecipientUse(metadata: BankActionEntity['metadata']): boolean {
    const txCountToRecipient = metadata?.txCountToRecipient;
    if (typeof txCountToRecipient === 'number') return txCountToRecipient <= 0;
    const previousUseCount = metadata?.previousUseCount;
    if (typeof previousUseCount === 'number') return previousUseCount <= 0;
    return metadata?.hasPreviousUse === false;
  }

  private findSmallTestPaymentAction(actions: BankActionEntity[]): BankActionEntity | undefined {
    const amountAction = actions.find((action) => this.hasSmallPaymentAmount(action.metadata));
    if (amountAction === undefined) return undefined;
    return actions.find((action) => this.hasTestPaymentPattern(action.metadata));
  }

  private hasSmallPaymentAmount(metadata: BankActionEntity['metadata']): boolean {
    const amount = this.extractNumberMetadata(metadata, ['amount', 'transferAmount', 'transactionAmount']);
    return amount !== null && amount > 0 && amount < SMALL_TEST_PAYMENT_AMOUNT_LIMIT;
  }

  private hasTestPaymentPattern(metadata: BankActionEntity['metadata']): boolean {
    if (metadata?.testPaymentPattern === true || metadata?.isTestPayment === true) return true;
    return this.extractTextMetadata(metadata, ['paymentPattern', 'comment', 'purpose', 'description', 'message', 'remittanceInfo'])
      .some((value) => TEST_PAYMENT_TEXT_PATTERN.test(value));
  }

  private serverFactorReasonCodes(factor: string, metadata: BankActionEntity['metadata']): string[] {
    const reason = metadata?.reason;
    if (typeof reason === 'string' && reason.trim() !== '') return [reason];
    const reasonCodes = metadata?.reasonCodes;
    if (Array.isArray(reasonCodes)) {
      const validReasonCodes = reasonCodes.filter((value): value is string => typeof value === 'string' && value.trim() !== '');
      if (validReasonCodes.length > 0) return validReasonCodes;
    }
    return [`${factor}_server_helper`];
  }

  private hasNewRecipientLayeringPattern(actions: BankActionEntity[]): boolean {
    const recipientActions = actions
      .filter((action) => action.kind === 'recipient_created')
      .sort((left, right) => left.atMs - right.atMs);

    return recipientActions.some((action, index) => {
      const windowActions = recipientActions
        .slice(index)
        .filter((candidate) => candidate.atMs - action.atMs <= LAYERING_WINDOW_MS);
      return (
        windowActions.length >= LAYERING_RECIPIENT_COUNT &&
        this.hasDistinctRecipients(windowActions) &&
        this.hasDistinctAmounts(windowActions)
      );
    });
  }

  private hasDistinctRecipients(actions: BankActionEntity[]): boolean {
    const recipientKeys = actions
      .map((action) => this.extractStringMetadata(action.metadata, ['recipientId', 'beneficiaryId', 'accountNumber', 'iban']))
      .filter((value): value is string => value !== null);
    if (recipientKeys.length === 0) return true;
    return new Set(recipientKeys).size >= LAYERING_RECIPIENT_COUNT;
  }

  private hasDistinctAmounts(actions: BankActionEntity[]): boolean {
    const amounts = actions
      .map((action) => this.extractNumberMetadata(action.metadata, ['amount', 'transferAmount', 'transactionAmount']))
      .filter((value): value is number => value !== null);
    return amounts.length >= LAYERING_RECIPIENT_COUNT && new Set(amounts.map((amount) => amount.toFixed(2))).size >= LAYERING_RECIPIENT_COUNT;
  }

  private extractStringMetadata(metadata: BankActionEntity['metadata'], keys: string[]): string | null {
    for (const key of keys) {
      const value = metadata?.[key];
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
    return null;
  }

  private extractTextMetadata(metadata: BankActionEntity['metadata'], keys: string[]): string[] {
    return keys
      .map((key) => metadata?.[key])
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  }

  private extractNumberMetadata(metadata: BankActionEntity['metadata'], keys: string[]): number | null {
    for (const key of keys) {
      const value = metadata?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const normalizedValue = Number(value.replace(',', '.'));
        if (Number.isFinite(normalizedValue)) return normalizedValue;
      }
    }
    return null;
  }

  private warningDwellRecognitions(
    actions: BankActionEntity[],
    catalog: ParsedScenarioCatalogEntity,
  ): ScenarioRecognitionEntity[] {
    return this.warningDwellSignalBuildingService
      .build(this.warningDwellObservations(actions))
      .map((signal) => this.createRecognition(
        signal.kind,
        signal.confidence ?? 1,
        signal.reasonCodes ?? [signal.kind],
        catalog,
        {
          contribution: signal.contribution,
          maxContribution: signal.maxContribution,
          metadata: signal.metadata,
        },
      ));
  }

  private keystrokeDynamicsRecognitions(
    actions: BankActionEntity[],
    catalog: ParsedScenarioCatalogEntity,
  ): ScenarioRecognitionEntity[] {
    return this.keystrokeDynamicsSignalBuildingService
      .build(
        this.eventReasonCodes(actions, 'keystroke_anomaly_observed', 'keystroke_dynamics_anomaly'),
        this.actionMetadata(actions, 'keystroke_anomaly_observed'),
      )
      .map((signal) => this.createRecognition(
        signal.kind,
        signal.confidence ?? 1,
        signal.reasonCodes ?? [signal.kind],
        catalog,
        {
          contribution: signal.contribution,
          maxContribution: signal.maxContribution,
          metadata: signal.metadata,
        },
      ));
  }

  private pageVisibilityRecognitions(
    actions: BankActionEntity[],
    catalog: ParsedScenarioCatalogEntity,
  ): ScenarioRecognitionEntity[] {
    return this.pageVisibilitySignalBuildingService
      .build(this.pageVisibilityReasonCodes(actions), this.pageVisibilityMetadata(actions))
      .map((signal) => this.createRecognition(
        signal.kind,
        signal.confidence ?? 1,
        signal.reasonCodes ?? [signal.kind],
        catalog,
        {
          contribution: signal.contribution,
          maxContribution: signal.maxContribution,
          metadata: signal.metadata,
        },
      ));
  }

  private devEnvironmentRecognitions(
    actions: BankActionEntity[],
    catalog: ParsedScenarioCatalogEntity,
  ): ScenarioRecognitionEntity[] {
    return this.devEnvironmentSignalBuildingService
      .build(
        this.eventReasonCodes(actions, 'dev_environment_observed', 'dev_environment'),
        this.actionMetadata(actions, 'dev_environment_observed'),
      )
      .map((signal) => this.createRecognition(
        signal.kind,
        signal.confidence ?? 1,
        signal.reasonCodes ?? [signal.kind],
        catalog,
        {
          contribution: signal.contribution,
          maxContribution: signal.maxContribution,
          metadata: signal.metadata,
        },
      ));
  }

  private pointerPatternRecognitions(
    actions: BankActionEntity[],
    catalog: ParsedScenarioCatalogEntity,
  ): ScenarioRecognitionEntity[] {
    return this.pointerPatternSignalBuildingService
      .build(
        this.pointerReasonCodes(actions),
        this.pointerMetadata(actions),
      )
      .map((signal) => this.createRecognition(
        signal.kind,
        signal.confidence ?? 1,
        signal.reasonCodes ?? [signal.kind],
        catalog,
        {
          contribution: signal.contribution,
          maxContribution: signal.maxContribution,
          metadata: signal.metadata,
        },
      ));
  }

  private phishingUrlRecognitions(
    actions: BankActionEntity[],
    catalog: ParsedScenarioCatalogEntity,
  ): ScenarioRecognitionEntity[] {
    return this.phishingUrlSignalBuildingService
      .build(
        this.eventReasonCodes(actions, 'phishing_url_observed', 'phishing_url_pattern'),
        this.actionMetadata(actions, 'phishing_url_observed'),
      )
      .map((signal) => this.createRecognition(
        signal.kind,
        signal.confidence ?? 1,
        signal.reasonCodes ?? [signal.kind],
        catalog,
        {
          contribution: signal.contribution,
          maxContribution: signal.maxContribution,
          metadata: signal.metadata,
        },
      ));
  }

  private pointerReasonCodes(actions: BankActionEntity[]): string[] {
    return [
      ...this.eventReasonCodes(actions, 'pointer_anomaly_observed', 'pointer_pattern_anomaly'),
      ...this.eventReasonCodes(actions, 'rapid_scroll_observed', 'rapid_scroll_pattern'),
      ...this.eventReasonCodes(actions, 'click_burst_observed', 'click_burst_pattern'),
    ];
  }

  private pageVisibilityReasonCodes(actions: BankActionEntity[]): string[] {
    return this.pageVisibilityActions(actions)
      .reduce<string[]>((reasonCodes, action) => [
        ...reasonCodes,
        ...this.metadataReasonCodes(action.metadata, ''),
      ], []);
  }

  private pageVisibilityMetadata(actions: BankActionEntity[]): Record<string, unknown> {
    const pageVisibilityActions = this.pageVisibilityActions(actions);
    const observations = pageVisibilityActions
      .filter((action) => this.isMetadataRecord(action.metadata))
      .map((action) => action.metadata as Record<string, unknown>);
    const latestMetadata = observations.length > 0 ? observations[observations.length - 1] : {};
    return {
      ...latestMetadata,
      eventCount: pageVisibilityActions.length,
      hiddenCount: this.countActions(actions, 'page_hidden'),
      visibleCount: this.countActions(actions, 'page_visible'),
      observedCount: this.countActions(actions, 'page_visibility_observed'),
      observations,
    };
  }

  private pageVisibilityActions(actions: BankActionEntity[]): BankActionEntity[] {
    return actions.filter((action) => (
      action.kind === 'page_hidden' ||
      action.kind === 'page_visible' ||
      action.kind === 'page_visibility_observed'
    ));
  }

  private pointerMetadata(actions: BankActionEntity[]): Record<string, unknown> {
    const pointerActions = actions.filter((action) => (
      action.kind === 'pointer_anomaly_observed' ||
      action.kind === 'rapid_scroll_observed' ||
      action.kind === 'click_burst_observed'
    ));
    const observations = pointerActions
      .filter((action) => this.isMetadataRecord(action.metadata))
      .map((action) => action.metadata as Record<string, unknown>);
    const latestMetadata = observations.length > 0 ? observations[observations.length - 1] : {};
    return {
      ...latestMetadata,
      eventCount: pointerActions.length,
      observations,
    };
  }

  private warningDwellObservations(actions: BankActionEntity[]): WarningDwellObservationEntity[] {
    return actions.filter((action): action is WarningDwellObservationEntity => (
      action.kind === 'warning_shown' ||
      action.kind === 'warning_confirmed' ||
      action.kind === 'warning_scrolled'
    ));
  }

  private unique<T>(items: T[]): T[] {
    return items.filter((item, index) => items.indexOf(item) === index);
  }

  private countActions(actions: BankActionEntity[], kind: BankActionEntity['kind']): number {
    return actions.filter((action) => action.kind === kind).length;
  }

  private eventReasonCodes(actions: BankActionEntity[], kind: BankActionEntity['kind'], fallback: string): string[] {
    return actions
      .filter((action) => action.kind === kind)
      .reduce<string[]>((reasonCodes, action) => [
        ...reasonCodes,
        ...this.metadataReasonCodes(action.metadata, fallback),
      ], []);
  }

  private actionMetadata(actions: BankActionEntity[], kind: BankActionEntity['kind']): Record<string, unknown> {
    const observations = actions
      .filter((action) => action.kind === kind && this.isMetadataRecord(action.metadata))
      .map((action) => action.metadata as Record<string, unknown>);
    const latestMetadata = observations.length > 0 ? observations[observations.length - 1] : {};
    return {
      ...latestMetadata,
      eventCount: this.countActions(actions, kind),
      observations,
    };
  }

  private optionalActionMetadata(
    actions: BankActionEntity[],
    kind: BankActionEntity['kind'],
  ): Record<string, unknown> | undefined {
    if (!actions.some((action) => action.kind === kind && this.isMetadataRecord(action.metadata))) return undefined;
    return this.actionMetadata(actions, kind);
  }

  private metadataReasonCodes(metadata: BankActionEntity['metadata'], fallback: string): string[] {
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
}
