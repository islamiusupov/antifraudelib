import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { KeystrokeDynamicsInputEntity } from '../../domain/ml/entities/KeystrokeDynamicsInputEntity';
import { KeystrokeDynamicsFeatureVectorBuildingService } from './KeystrokeDynamicsFeatureVectorBuildingService';
import { KeystrokeDynamicsModelScoringService } from './KeystrokeDynamicsModelScoringService';

export class KeystrokeDynamicsClassifyingService {
  constructor(
    private readonly keystrokeDynamicsFeatureVectorBuildingService = new KeystrokeDynamicsFeatureVectorBuildingService(),
    private readonly keystrokeDynamicsModelScoringService = new KeystrokeDynamicsModelScoringService(),
  ) {}

  classify(input: KeystrokeDynamicsInputEntity): RiskSignalEntity {
    const features = this.keystrokeDynamicsFeatureVectorBuildingService.build(input);
    const modelScore = this.keystrokeDynamicsModelScoringService.score(features);
    if (modelScore.score < modelScore.threshold) {
      return this.inactive();
    }

    return {
      kind: 'keystroke_dynamics',
      detected: true,
      confidence: 0.8,
      reasonCodes: ['keystroke_dynamics_anomaly'],
      source: 'live',
      metadata: {
        classifier: modelScore.modelId,
        modelScore: modelScore.score,
        features: modelScore.features,
      },
    };
  }

  private inactive(): RiskSignalEntity {
    return {
      kind: 'keystroke_dynamics',
      detected: false,
      confidence: 0,
      reasonCodes: [],
      source: 'live',
    };
  }
}
