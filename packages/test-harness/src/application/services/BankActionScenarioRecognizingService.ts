import type { RiskFactorKind, RiskSignalEntity } from '@deepcode/antifraud-core';
import type { ParsedScenarioCatalogEntity } from '@deepcode/antifraud-scenario-catalog';
import type { BankActionEntity } from '../../domain/entities/BankActionEntity';
import type { ScenarioRecognitionEntity } from '../../domain/entities/ScenarioRecognitionEntity';
import type { ScenarioRecognitionResultEntity } from '../../domain/entities/ScenarioRecognitionResultEntity';
import { CompositeScenarioRecognizingService } from './CompositeScenarioRecognizingService';

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

    if (this.hasAction(actions, 'media_active')) {
      recognitions.push(this.createRecognition('concurrent_media', 1, ['concurrent_media_active'], catalog));
    }
    if (this.hasAction(actions, 'recipient_created')) {
      recognitions.push(this.createRecognition('new_recipient', 1, ['new_recipient_in_flow'], catalog));
    }
    if (this.hasAction(actions, 'recipient_pasted')) {
      recognitions.push(this.createRecognition('copy_paste_recipient', 1, ['copy_paste_recipient'], catalog));
    }
    if (this.hasFastWarningConfirmation(actions)) {
      recognitions.push(this.createRecognition('warning_dwell', 0.9, ['warning_dwell_too_short'], catalog));
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
