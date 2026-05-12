import type { RiskFactorKind } from '../value-objects/RiskFactorKind';

export type RiskReasonEntity = {
  code: string;
  factorKind: RiskFactorKind;
  contribution: number;
};
