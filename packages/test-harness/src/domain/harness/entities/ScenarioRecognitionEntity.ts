import type { RiskFactorKind } from '@deepcode/antifraud-core';
import type { ScenarioVerdict } from '@deepcode/antifraud-scenario-catalog';

export type ScenarioRecognitionEntity = {
  factor: RiskFactorKind;
  confidence: number;
  contribution?: number;
  maxContribution?: number;
  reasonCodes: string[];
  candidateScenarioIds: string[];
  expectedVerdicts: ScenarioVerdict[];
  metadata?: Record<string, unknown>;
};
