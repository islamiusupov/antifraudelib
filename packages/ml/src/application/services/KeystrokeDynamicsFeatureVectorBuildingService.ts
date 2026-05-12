import type { KeystrokeDynamicsFeatureVectorEntity } from '../../domain/ml/entities/KeystrokeDynamicsFeatureVectorEntity';
import type { KeystrokeDynamicsInputEntity } from '../../domain/ml/entities/KeystrokeDynamicsInputEntity';

export class KeystrokeDynamicsFeatureVectorBuildingService {
  build(input: KeystrokeDynamicsInputEntity): KeystrokeDynamicsFeatureVectorEntity {
    if (input.intervalsMs.length === 0 || input.baselineMedianMs <= 0) {
      return {
        meanRelativeDeviation: 0,
        maxRelativeDeviation: 0,
        longPauseRatio: 0,
        sampleSize: input.intervalsMs.length,
      };
    }

    const relativeDeviations = input.intervalsMs.map((intervalMs) => {
      return Math.abs(intervalMs - input.baselineMedianMs) / input.baselineMedianMs;
    });
    const longPauseThreshold = Math.max(input.baselineMedianMs * 4, 800);

    return {
      meanRelativeDeviation: this.average(relativeDeviations),
      maxRelativeDeviation: Math.max(...relativeDeviations),
      longPauseRatio: input.intervalsMs.filter((intervalMs) => intervalMs >= longPauseThreshold).length / input.intervalsMs.length,
      sampleSize: input.intervalsMs.length,
    };
  }

  private average(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}
