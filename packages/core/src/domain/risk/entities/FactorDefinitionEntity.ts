import type { KnownRiskFactorKind } from '../../value-objects/RiskFactorKind';
import type { RiskFactorSource } from '../../value-objects/RiskFactorSource';
import type { RiskFactorTier } from '../../value-objects/RiskFactorTier';

export type FactorDefinitionEntity = {
  kind: KnownRiskFactorKind;
  maxContribution: number;
  source: RiskFactorSource;
  tier: RiskFactorTier;
};
