import type { RiskFactorKind } from '@deepcode/antifraud-core';
import type { ScenarioVerdict } from '@deepcode/antifraud-scenario-catalog';

export type ScenarioRecognitionEntity = {
  factor: RiskFactorKind;
  confidence: number;
  reasonCodes: string[];
  candidateScenarioIds: string[];
  expectedVerdicts: ScenarioVerdict[];
};
