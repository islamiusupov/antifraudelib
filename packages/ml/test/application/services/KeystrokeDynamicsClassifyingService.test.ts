import { describe, expect, it } from 'vitest';
import { KeystrokeDynamicsClassifyingService } from '../../../src/application/services/KeystrokeDynamicsClassifyingService';

describe('KeystrokeDynamicsClassifyingService', () => {
  it('returns inactive signal for stable keystroke intervals', () => {
    const service = new KeystrokeDynamicsClassifyingService();

    expect(
      service.classify({
        intervalsMs: [120, 130, 125, 135],
        baselineMedianMs: 125,
      }),
    ).toEqual({
      kind: 'keystroke_dynamics',
      detected: false,
      confidence: 0,
      reasonCodes: [],
      source: 'live',
    });
  });

  it('detects high-deviation keystroke intervals through fallback classifier', () => {
    const service = new KeystrokeDynamicsClassifyingService();

    expect(
      service.classify({
        intervalsMs: [120, 900, 1400, 110],
        baselineMedianMs: 125,
      }),
    ).toEqual({
      kind: 'keystroke_dynamics',
      detected: true,
      confidence: 0.8,
      reasonCodes: ['keystroke_dynamics_anomaly'],
      source: 'live',
      metadata: {
        classifier: 'keystroke-dynamics-timing-v0',
        modelScore: 1,
        features: {
          meanRelativeDeviation: 4.14,
          maxRelativeDeviation: 10.2,
          longPauseRatio: 0.5,
          sampleSize: 4,
        },
      },
    });
  });
});
