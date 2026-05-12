import type { RiskFactorKind } from '@deepcode/antifraud-core';
import type { ScenarioVerdict } from '@deepcode/antifraud-scenario-catalog';

export type CompositeScenarioRecognitionEntity = {
  id: string;
  title: string;
  confidence: number;
  requiredScenarioIds: string[];
  matchedScenarioIds: string[];
  factors: RiskFactorKind[];
  reasonCodes: string[];
  expectedVerdict: ScenarioVerdict;
};
