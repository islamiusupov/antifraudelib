import type { RiskScope } from '../value-objects/RiskScope';
import type { RiskFactorEntity } from './RiskFactorEntity';

export type RiskScoringRequestEntity = {
  scope: RiskScope;
  factors: RiskFactorEntity[];
  maxScore?: number;
};
