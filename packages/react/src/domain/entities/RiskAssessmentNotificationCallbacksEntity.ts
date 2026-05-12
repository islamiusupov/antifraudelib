import type { RiskAssessmentEntity, RiskDecisionEntity } from '@deepcode/antifraud-core';

export type RiskAssessmentNotificationCallbacksEntity = {
  onScore?: (assessment: RiskAssessmentEntity) => void;
  onDecision?: (decision: RiskDecisionEntity, assessment: RiskAssessmentEntity) => void;
};
