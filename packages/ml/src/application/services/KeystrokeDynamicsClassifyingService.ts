import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { KeystrokeDynamicsInputEntity } from '../../domain/ml/entities/KeystrokeDynamicsInputEntity';
import type { KeystrokeBaselineProfileMatchEntity } from '../../domain/ml/entities/KeystrokeBaselineProfileMatchEntity';
import { KeystrokeBaselineProfileMatchingService } from './KeystrokeBaselineProfileMatchingService';
import { KeystrokeDynamicsFeatureVectorBuildingService } from './KeystrokeDynamicsFeatureVectorBuildingService';
import { KeystrokeDynamicsModelScoringService } from './KeystrokeDynamicsModelScoringService';

const ONNX_NOT_USER_MINIMUM_CONFIDENCE = 0.9;
const ONNX_MATCH_MINIMUM_CONFIDENCE = 0.85;

export class KeystrokeDynamicsClassifyingService {
  constructor(
    private readonly keystrokeDynamicsFeatureVectorBuildingService = new KeystrokeDynamicsFeatureVectorBuildingService(),
    private readonly keystrokeDynamicsModelScoringService = new KeystrokeDynamicsModelScoringService(),
    private readonly keystrokeBaselineProfileMatchingService = new KeystrokeBaselineProfileMatchingService(),
  ) {}

  classify(input: KeystrokeDynamicsInputEntity): RiskSignalEntity {
    const baselineProfileMatch = this.keystrokeBaselineProfileMatchingService.match(input);
    if (baselineProfileMatch.verdict === 'monitor') {
      return this.monitor(baselineProfileMatch);
    }
    if (baselineProfileMatch.verdict === 'allow') {
      return this.inactiveFromBaselineProfile(baselineProfileMatch);
    }

    const features = this.keystrokeDynamicsFeatureVectorBuildingService.build(input);
    const modelScore = this.keystrokeDynamicsModelScoringService.score(features);
    if (modelScore.score < modelScore.threshold) {
      return this.inactive(modelScore);
    }

    if (modelScore.score > ONNX_NOT_USER_MINIMUM_CONFIDENCE) {
      return {
        kind: 'keystroke_dynamics',
        detected: true,
        confidence: modelScore.score,
        reasonCodes: ['onnx_not_user_high_confidence'],
        source: 'live',
        metadata: {
          classifier: modelScore.modelId,
          confidence: modelScore.score,
          features: modelScore.features,
          modelScore: modelScore.score,
          verdict: 'not_user',
        },
      };
    }

    return {
      kind: 'keystroke_dynamics',
      detected: true,
      confidence: 0.8,
      reasonCodes: ['keystroke_dynamics_anomaly'],
      source: 'live',
      metadata: {
        classifier: modelScore.modelId,
        confidence: modelScore.score,
        modelScore: modelScore.score,
        features: modelScore.features,
        verdict: 'not_user',
      },
    };
  }

  private monitor(baselineProfileMatch: KeystrokeBaselineProfileMatchEntity): RiskSignalEntity {
    return {
      kind: 'keystroke_dynamics',
      detected: true,
      confidence: baselineProfileMatch.confidence,
      reasonCodes: baselineProfileMatch.reasonCode === undefined ? [] : [baselineProfileMatch.reasonCode],
      source: 'live',
      metadata: baselineProfileMatch.metadata,
    };
  }

  private inactiveFromBaselineProfile(baselineProfileMatch: KeystrokeBaselineProfileMatchEntity): RiskSignalEntity {
    return {
      kind: 'keystroke_dynamics',
      detected: false,
      confidence: 0,
      reasonCodes: baselineProfileMatch.reasonCode === undefined ? [] : [baselineProfileMatch.reasonCode],
      source: 'live',
      metadata: baselineProfileMatch.metadata,
    };
  }

  private inactive(modelScore: ReturnType<KeystrokeDynamicsModelScoringService['score']>): RiskSignalEntity {
    const matchConfidence = this.round(1 - modelScore.score);
    const reasonCodes = ['local_baseline_scaled_manhattan_match'];
    if (matchConfidence > ONNX_MATCH_MINIMUM_CONFIDENCE) {
      reasonCodes.push('onnx_user_match_high_confidence');
    }
    return {
      kind: 'keystroke_dynamics',
      detected: false,
      confidence: 0,
      reasonCodes,
      source: 'live',
      metadata: {
        classifier: modelScore.modelId,
        confidence: matchConfidence,
        features: modelScore.features,
        modelScore: modelScore.score,
        scaledManhattanDistance: modelScore.features.meanRelativeDeviation,
        threshold: modelScore.threshold,
        verdict: matchConfidence > ONNX_MATCH_MINIMUM_CONFIDENCE ? 'match' : 'baseline_match',
      },
    };
  }

  private round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
