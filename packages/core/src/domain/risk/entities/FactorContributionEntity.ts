import type { RiskFactorKind } from '../../value-objects/RiskFactorKind';
import type { RiskFactorSource } from '../../value-objects/RiskFactorSource';
import type { RiskFactorStatus } from '../../value-objects/RiskFactorStatus';

export type FactorContributionEntity = {
  kind: RiskFactorKind;
  status: RiskFactorStatus;
  source?: RiskFactorSource;
  rawContribution: number;
  contribution: number;
  maxContribution: number;
  reasonCodes: string[];
  metadata?: Record<string, unknown>;
};
