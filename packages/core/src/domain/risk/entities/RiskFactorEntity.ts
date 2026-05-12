import type { RiskFactorKind } from '../../value-objects/RiskFactorKind';
import type { RiskFactorSource } from '../../value-objects/RiskFactorSource';
import type { RiskFactorStatus } from '../../value-objects/RiskFactorStatus';

export type RiskFactorEntity = {
  kind: RiskFactorKind;
  contribution: number;
  maxContribution?: number;
  status?: RiskFactorStatus;
  reasonCodes?: string[];
  source?: RiskFactorSource;
  metadata?: Record<string, unknown>;
};
