import { describe, expect, it } from 'vitest';
import { KeystrokeDynamicsFeatureVectorBuildingService } from '../../../src/application/services/KeystrokeDynamicsFeatureVectorBuildingService';

describe('KeystrokeDynamicsFeatureVectorBuildingService', () => {
  it('builds normalized timing features without storing raw keys', () => {
    const service = new KeystrokeDynamicsFeatureVectorBuildingService();

    expect(
      service.build({
        intervalsMs: [120, 900, 1400, 110],
        baselineMedianMs: 125,
      }),
    ).toEqual({
      meanRelativeDeviation: 4.14,
      maxRelativeDeviation: 10.2,
      longPauseRatio: 0.5,
      sampleSize: 4,
    });
  });

  it('returns zeroed features when the baseline is not usable', () => {
    const service = new KeystrokeDynamicsFeatureVectorBuildingService();

    expect(
      service.build({
        intervalsMs: [100, 200],
        baselineMedianMs: 0,
      }),
    ).toEqual({
      meanRelativeDeviation: 0,
      maxRelativeDeviation: 0,
      longPauseRatio: 0,
      sampleSize: 2,
    });
  });

  it('treats empty interval samples as insufficient for behavioral deviation', () => {
    const service = new KeystrokeDynamicsFeatureVectorBuildingService();

    expect(
      service.build({
        intervalsMs: [],
        baselineMedianMs: 125,
      }),
    ).toEqual({
      meanRelativeDeviation: 0,
      maxRelativeDeviation: 0,
      longPauseRatio: 0,
      sampleSize: 0,
    });
  });
});
