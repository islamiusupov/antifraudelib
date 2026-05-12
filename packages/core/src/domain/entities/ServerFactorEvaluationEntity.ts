import type { RiskFactorKind } from '../value-objects/RiskFactorKind';
import type { RiskFactorStatus } from '../value-objects/RiskFactorStatus';

export type ServerFactorEvaluationEntity = {
  kind: RiskFactorKind;
  status: RiskFactorStatus;
  contribution: number;
  maxContribution: number;
  reasonCodes: string[];
  metadata?: Record<string, unknown>;
};
