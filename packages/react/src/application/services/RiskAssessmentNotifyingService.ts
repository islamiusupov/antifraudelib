import type { RiskAssessmentEntity } from '@deepcode/antifraud-core';
import type { RiskAssessmentNotificationCallbacksEntity } from '../../domain/entities/RiskAssessmentNotificationCallbacksEntity';

export class RiskAssessmentNotifyingService {
  notify(
    assessment: RiskAssessmentEntity,
    callbacks: RiskAssessmentNotificationCallbacksEntity,
    previousNotificationKey?: string,
  ): string {
    const notificationKey = this.buildNotificationKey(assessment);
    if (notificationKey === previousNotificationKey) return notificationKey;

    callbacks.onScore?.(assessment);
    callbacks.onDecision?.(assessment.decision, assessment);
    return notificationKey;
  }

  buildNotificationKey(assessment: RiskAssessmentEntity): string {
    return JSON.stringify({
      score: assessment.score,
      level: assessment.decision.level,
      reasons: assessment.decision.reasons.map((reason) => [
        reason.factorKind,
        reason.code,
        reason.contribution,
      ]),
      factors: assessment.factorContributions.map((factor) => [
        factor.kind,
        factor.status,
        factor.contribution,
      ]),
    });
  }
}
