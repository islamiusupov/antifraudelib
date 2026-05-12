import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { KeystrokeDynamicsInputEntity } from '../../domain/entities/KeystrokeDynamicsInputEntity';

export class KeystrokeDynamicsClassifyingService {
  classify(input: KeystrokeDynamicsInputEntity): RiskSignalEntity {
    const score = this.scaledManhattan(input.intervalsMs, input.baselineMedianMs);
    if (score < 1.5) {
      return this.inactive();
    }

    return {
      kind: 'keystroke_dynamics',
      detected: true,
      confidence: 0.8,
      reasonCodes: ['keystroke_dynamics_anomaly'],
      source: 'live',
      metadata: {
        classifier: 'scaled_manhattan',
      },
    };
  }

  private scaledManhattan(intervalsMs: number[], baselineMedianMs: number): number {
    if (intervalsMs.length === 0 || baselineMedianMs <= 0) return 0;
    const totalDeviation = intervalsMs.reduce((total, intervalMs) => {
      return total + Math.abs(intervalMs - baselineMedianMs) / baselineMedianMs;
    }, 0);
    return totalDeviation / intervalsMs.length;
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
