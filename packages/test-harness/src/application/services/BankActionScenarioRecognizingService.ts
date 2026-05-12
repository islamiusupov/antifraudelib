import type { RiskFactorKind, RiskSignalEntity } from '@deepcode/antifraud-core';
import type { ParsedScenarioCatalogEntity } from '@deepcode/antifraud-scenario-catalog';
import type { BankActionEntity } from '../../domain/harness/entities/BankActionEntity';
import type { ScenarioRecognitionEntity } from '../../domain/harness/entities/ScenarioRecognitionEntity';
import type { ScenarioRecognitionResultEntity } from '../../domain/harness/entities/ScenarioRecognitionResultEntity';
import { CompositeScenarioRecognizingService } from './CompositeScenarioRecognizingService';

const LAYERING_RECIPIENT_COUNT = 3;
const LAYERING_WINDOW_MS = 60 * 60 * 1000;

export class BankActionScenarioRecognizingService {
  constructor(private readonly compositeScenarioRecognizingService = new CompositeScenarioRecognizingService()) {}

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

    if (this.hasAction(actions, 'media_active')) {
      recognitions.push(this.createRecognition('concurrent_media', 1, ['concurrent_media_active'], catalog));
    }
    if (this.hasAction(actions, 'recipient_created')) {
      recognitions.push(
        this.createRecognition(
          'new_recipient',
          1,
          hasNewRecipientLayeringPattern ? ['new_recipient_layering_pattern'] : ['new_recipient_in_flow'],
          catalog,
        ),
      );
      if (this.hasCurrentSessionUnusedRecipient(actions)) {
        recognitions.push(
          this.createRecognition(
            'composite_risk_boost',
            1,
            ['recipient_added_current_session_no_previous_use'],
            catalog,
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
      recognitions.push(this.createRecognition('copy_paste_recipient', 1, ['copy_paste_recipient'], catalog));
    }
    if (this.hasAction(actions, 'amount_pasted')) {
      recognitions.push(this.createRecognition('copy_paste_amount', 1, ['copy_paste_amount'], catalog));
    }
    if (this.hasFastWarningConfirmation(actions)) {
      recognitions.push(this.createRecognition('warning_dwell', 0.9, ['warning_dwell_too_short'], catalog));
    }
    if (this.hasAction(actions, 'form_fill_order_observed')) {
      recognitions.push(this.createRecognition('form_fill_order', 1, ['multi_field_recipient_bulk_fill'], catalog));
    }
    if (this.hasAction(actions, 'page_hidden') && this.hasAction(actions, 'page_visible')) {
      recognitions.push(this.createRecognition('page_visibility', 0.8, ['page_visibility_oscillation'], catalog));
    }
    if (this.hasAction(actions, 'visual_challenge_started')) {
      recognitions.push(this.createRecognition('visual_challenge', 1, ['visual_challenge_started'], catalog));
    }
    if (this.hasAction(actions, 'keystroke_anomaly_observed')) {
      recognitions.push(this.createRecognition('keystroke_dynamics', 0.8, ['keystroke_dynamics_anomaly'], catalog));
    }
    if (this.hasAction(actions, 'pointer_anomaly_observed')) {
      recognitions.push(this.createRecognition('pointer_pattern', 0.8, ['pointer_pattern_anomaly'], catalog));
    }
    if (this.hasAction(actions, 'rapid_scroll_observed')) {
      recognitions.push(this.createRecognition('pointer_pattern', 0.8, ['rapid_scroll_pattern'], catalog));
    }
    if (this.hasAction(actions, 'native_tampering_observed')) {
      recognitions.push(this.createRecognition('native_tampering', 1, ['native_tampering'], catalog));
    }
    if (this.hasAction(actions, 'dev_environment_observed')) {
      recognitions.push(this.createRecognition('dev_environment', 1, ['dev_environment'], catalog));
    }
    if (this.hasAction(actions, 'bot_detected')) {
      recognitions.push(this.createRecognition('bot_detection', 1, ['bot_detection'], catalog));
    }
    if (this.hasAction(actions, 'phishing_text_observed')) {
      recognitions.push(this.createRecognition('phishing_text_dom', 1, ['phishing_text_dom'], catalog));
    }
    if (this.hasAction(actions, 'phishing_url_observed')) {
      recognitions.push(this.createRecognition('phishing_url', 1, ['phishing_url_pattern'], catalog));
    }
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
      recognitions.push(this.createRecognition('device_fingerprint', 1, ['device_fingerprint'], catalog));
    }

    const serverFactorActions = actions.filter((action) => action.kind === 'server_factor_observed');
    serverFactorActions.forEach((action) => {
      const factor = action.metadata?.factor;
      if (typeof factor !== 'string') return;
      recognitions.push(this.createRecognition(factor, 1, [`${factor}_server_helper`], catalog));
    });

    return recognitions;
  }

  private createRecognition(
    factor: RiskFactorKind,
    confidence: number,
    reasonCodes: string[],
    catalog: ParsedScenarioCatalogEntity,
  ): ScenarioRecognitionEntity {
    const candidates = catalog.scenarios.filter((scenario) => scenario.factor === factor);
    return {
      factor,
      confidence,
      reasonCodes,
      candidateScenarioIds: candidates.map((scenario) => scenario.id),
      expectedVerdicts: this.unique(candidates.map((scenario) => scenario.normalizedVerdict)),
    };
  }

  private toRiskSignal(recognition: ScenarioRecognitionEntity): RiskSignalEntity {
    return {
      kind: recognition.factor,
      detected: true,
      confidence: recognition.confidence,
      reasonCodes: recognition.reasonCodes,
      source: 'live',
    };
  }

  private hasAction(actions: BankActionEntity[], kind: BankActionEntity['kind']): boolean {
    return actions.some((action) => action.kind === kind);
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

  private hasFastWarningConfirmation(actions: BankActionEntity[]): boolean {
    const warningShown = actions.find((action) => action.kind === 'warning_shown');
    const warningConfirmed = actions.find((action) => action.kind === 'warning_confirmed');
    if (warningShown === undefined || warningConfirmed === undefined) return false;
    return warningConfirmed.atMs - warningShown.atMs < 1000;
  }

  private unique<T>(items: T[]): T[] {
    return items.filter((item, index) => items.indexOf(item) === index);
  }
}
