import type { RiskDecisionLevel } from '../value-objects/RiskDecisionLevel';
import type { RiskReasonEntity } from './RiskReasonEntity';

export type RiskDecisionEntity = {
  level: RiskDecisionLevel;
  score: number;
  reasons: RiskReasonEntity[];
};
