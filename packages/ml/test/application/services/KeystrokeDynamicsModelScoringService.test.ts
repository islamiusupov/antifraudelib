import { describe, expect, it } from 'vitest';
import { KeystrokeDynamicsModelScoringService } from '../../../src/application/services/KeystrokeDynamicsModelScoringService';

describe('KeystrokeDynamicsModelScoringService', () => {
  it('scores stable timing features below the anomaly threshold', () => {
    const service = new KeystrokeDynamicsModelScoringService();

    const result = service.score({
      meanRelativeDeviation: 0.04,
      maxRelativeDeviation: 0.08,
      longPauseRatio: 0,
      sampleSize: 4,
    });

    expect(result).toMatchObject({
      modelId: 'keystroke-dynamics-timing-v0',
      threshold: 0.75,
      score: 0.0548,
    });
  });

  it('scores high deviation timing features above the anomaly threshold', () => {
    const service = new KeystrokeDynamicsModelScoringService();

    const result = service.score({
      meanRelativeDeviation: 4.14,
      maxRelativeDeviation: 10.2,
      longPauseRatio: 0.5,
      sampleSize: 4,
    });

    expect(result.score).toBe(1);
    expect(result.threshold).toBe(0.75);
  });
});
