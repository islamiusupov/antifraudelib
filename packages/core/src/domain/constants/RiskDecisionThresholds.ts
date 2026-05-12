import type { DecisionThresholdsEntity } from '../entities/DecisionThresholdsEntity';

export const DEFAULT_RISK_DECISION_THRESHOLDS: DecisionThresholdsEntity = {
  monitor: 30,
  stepUp: 60,
  block: 85,
};
