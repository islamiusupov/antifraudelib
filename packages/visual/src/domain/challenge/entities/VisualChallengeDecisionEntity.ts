import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { VisualChallengeResult } from '../../value-objects/VisualChallengeResult';

export type VisualChallengeDecisionEntity = {
  result: VisualChallengeResult;
  reasonCodes: string[];
  riskSignal?: RiskSignalEntity;
};
