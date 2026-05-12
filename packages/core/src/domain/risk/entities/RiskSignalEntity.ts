import type { RiskFactorKind } from '../../value-objects/RiskFactorKind';
import type { RiskFactorSource } from '../../value-objects/RiskFactorSource';
import type { RiskFactorStatus } from '../../value-objects/RiskFactorStatus';

export type RiskSignalEntity = {
  kind: RiskFactorKind;
  detected: boolean;
  confidence?: number;
  contribution?: number;
  maxContribution?: number;
  status?: RiskFactorStatus;
  source?: RiskFactorSource;
  reasonCodes?: string[];
  metadata?: Record<string, unknown>;
};
