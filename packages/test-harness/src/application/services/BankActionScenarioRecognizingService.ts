import type { RiskFactorKind, RiskSignalEntity } from '@deepcode/antifraud-core';
import type { ParsedScenarioCatalogEntity } from '@deepcode/antifraud-scenario-catalog';
import type { BankActionEntity } from '../../domain/entities/BankActionEntity';
import type { ScenarioRecognitionEntity } from '../../domain/entities/ScenarioRecognitionEntity';
import type { ScenarioRecognitionResultEntity } from '../../domain/entities/ScenarioRecognitionResultEntity';

export class BankActionScenarioRecognizingService {
  recognize(actions: BankActionEntity[], catalog: ParsedScenarioCatalogEntity): ScenarioRecognitionResultEntity {
    const recognitions = this.recognizeFactors(actions, catalog);

    return {
      status: recognitions.length > 0 ? 'recognized' : 'no_match',
      target: 'd-bank',
      recognitions,
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
