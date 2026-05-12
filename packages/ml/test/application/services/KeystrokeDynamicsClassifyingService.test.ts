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
    ).toMatchObject({
      kind: 'keystroke_dynamics',
      detected: false,
      confidence: 0,
      reasonCodes: ['local_baseline_scaled_manhattan_match', 'onnx_user_match_high_confidence'],
      source: 'live',
      metadata: {
        classifier: 'keystroke-dynamics-timing-v0',
        scaledManhattanDistance: 0.04,
        threshold: 0.75,
        verdict: 'match',
      },
    });
  });

  it('returns local baseline allow when scaled Manhattan distance stays below threshold', () => {
    const service = new KeystrokeDynamicsClassifyingService();

    expect(
      service.classify({
        intervalsMs: [200, 210, 190, 220],
        baselineMedianMs: 125,
      }),
    ).toMatchObject({
      kind: 'keystroke_dynamics',
      detected: false,
      confidence: 0,
      reasonCodes: ['local_baseline_scaled_manhattan_match'],
      source: 'live',
      metadata: {
        classifier: 'keystroke-dynamics-timing-v0',
        scaledManhattanDistance: 0.64,
        threshold: 0.75,
        verdict: 'baseline_match',
      },
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
      confidence: 1,
      reasonCodes: ['onnx_not_user_high_confidence'],
      source: 'live',
      metadata: {
        classifier: 'keystroke-dynamics-timing-v0',
        confidence: 1,
        verdict: 'not_user',
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
