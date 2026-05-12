import { DEFAULT_RISK_DECISION_THRESHOLDS } from '../../domain/constants/RiskDecisionThresholds';
import type { DecisionThresholdsEntity } from '../../domain/risk/entities/DecisionThresholdsEntity';
import type { RiskDecisionLevel } from '../../domain/value-objects/RiskDecisionLevel';

export class RiskThresholdResolvingService {
  resolve(score: number, thresholds: DecisionThresholdsEntity = DEFAULT_RISK_DECISION_THRESHOLDS): RiskDecisionLevel {
    if (score >= thresholds.block) return 'block';
    if (score >= thresholds.stepUp) return 'step_up';
    if (score >= thresholds.monitor) return 'monitor';
    return 'allow';
  }
}
