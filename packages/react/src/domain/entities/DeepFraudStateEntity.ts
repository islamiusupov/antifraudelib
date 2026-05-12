import type { RiskAssessmentEntity, RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import type { DeepFraudConsent } from '../value-objects/DeepFraudConsent';

export type DeepFraudStateEntity = {
  userId: string;
  consent: DeepFraudConsent;
  rootFactors: RiskFactorEntity[];
  scopedFactors: Partial<Record<RiskScope, RiskFactorEntity[]>>;
  factors: RiskFactorEntity[];
  assessment: RiskAssessmentEntity;
};
