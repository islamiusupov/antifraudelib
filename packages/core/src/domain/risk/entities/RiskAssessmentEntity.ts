import type { RiskScope } from '../../value-objects/RiskScope';
import type { FactorContributionEntity } from './FactorContributionEntity';
import type { RiskDecisionEntity } from './RiskDecisionEntity';

export type RiskAssessmentEntity = {
  scope: RiskScope;
  score: number;
  decision: RiskDecisionEntity;
  factorContributions: FactorContributionEntity[];
};
