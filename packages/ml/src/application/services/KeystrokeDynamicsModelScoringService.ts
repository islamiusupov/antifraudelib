import {
  KEYSTROKE_DYNAMICS_MODEL_ID,
  KEYSTROKE_DYNAMICS_MODEL_THRESHOLD,
  KEYSTROKE_DYNAMICS_MODEL_WEIGHTS,
} from '../../domain/constants/KeystrokeDynamicsModelWeights';
import type { KeystrokeDynamicsFeatureVectorEntity } from '../../domain/entities/KeystrokeDynamicsFeatureVectorEntity';
import type { MlModelScoreEntity } from '../../domain/entities/MlModelScoreEntity';

export class KeystrokeDynamicsModelScoringService {
  score(features: KeystrokeDynamicsFeatureVectorEntity): MlModelScoreEntity {
    const logit =
      KEYSTROKE_DYNAMICS_MODEL_WEIGHTS.bias +
      KEYSTROKE_DYNAMICS_MODEL_WEIGHTS.meanRelativeDeviation * features.meanRelativeDeviation +
      KEYSTROKE_DYNAMICS_MODEL_WEIGHTS.maxRelativeDeviation * features.maxRelativeDeviation +
      KEYSTROKE_DYNAMICS_MODEL_WEIGHTS.longPauseRatio * features.longPauseRatio;

    return {
      modelId: KEYSTROKE_DYNAMICS_MODEL_ID,
      score: this.round(this.sigmoid(logit)),
      threshold: KEYSTROKE_DYNAMICS_MODEL_THRESHOLD,
      features: {
        meanRelativeDeviation: this.round(features.meanRelativeDeviation),
        maxRelativeDeviation: this.round(features.maxRelativeDeviation),
        longPauseRatio: this.round(features.longPauseRatio),
        sampleSize: features.sampleSize,
      },
    };
  }

  private sigmoid(value: number): number {
    return 1 / (1 + Math.exp(-value));
  }

  private round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
