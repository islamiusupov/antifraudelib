import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import type { DeepFraudStateEntity } from './DeepFraudStateEntity';

export type DeepFraudContextValueEntity = DeepFraudStateEntity & {
  replaceScopeFactors(scope: RiskScope, factors: RiskFactorEntity[]): void;
};
