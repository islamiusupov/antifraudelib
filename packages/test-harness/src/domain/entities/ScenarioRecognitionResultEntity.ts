import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { ScenarioRecognitionStatus } from '../value-objects/ScenarioRecognitionStatus';
import type { CompositeScenarioRecognitionEntity } from './CompositeScenarioRecognitionEntity';
import type { ScenarioRecognitionEntity } from './ScenarioRecognitionEntity';

export type ScenarioRecognitionResultEntity = {
  status: ScenarioRecognitionStatus;
  target: 'd-bank';
  recognitions: ScenarioRecognitionEntity[];
  compositeRecognitions: CompositeScenarioRecognitionEntity[];
  riskSignals: RiskSignalEntity[];
};
