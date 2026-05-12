import type { RiskScope } from '../../value-objects/RiskScope';
import type { DecisionThresholdsEntity } from './DecisionThresholdsEntity';
import type { RiskFactorEntity } from './RiskFactorEntity';

export type RiskScoringRequestEntity = {
  scope: RiskScope;
  factors: RiskFactorEntity[];
  thresholds?: DecisionThresholdsEntity;
  maxScore?: number;
  aggregationLimit?: number;
};
