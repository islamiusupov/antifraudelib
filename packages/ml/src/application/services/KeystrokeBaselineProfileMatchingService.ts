import type { KeystrokeBaselineProfileMatchEntity } from '../../domain/ml/entities/KeystrokeBaselineProfileMatchEntity';
import type { KeystrokeDynamicsInputEntity } from '../../domain/ml/entities/KeystrokeDynamicsInputEntity';

const DEFAULT_MINIMUM_BASELINE_SAMPLE_COUNT = 5;
const MINIMUM_PATTERN_SAMPLE_SIZE = 4;
const SLOW_CADENCE_RATIO = 1.25;
const FAST_CADENCE_RATIO = 0.8;
const PATTERN_DISTANCE_THRESHOLD = 0.2;

export class KeystrokeBaselineProfileMatchingService {
  match(input: KeystrokeDynamicsInputEntity): KeystrokeBaselineProfileMatchEntity {
    const baselineSufficiencyMatch = this.matchBaselineSufficiency(input);
    if (baselineSufficiencyMatch.verdict !== 'none') return baselineSufficiencyMatch;

    const inputMethodMatch = this.matchInputMethod(input);
    if (inputMethodMatch.verdict !== 'none') return inputMethodMatch;

    const keyboardLayoutMatch = this.matchKeyboardLayout(input);
    if (keyboardLayoutMatch.verdict !== 'none') return keyboardLayoutMatch;

    return this.matchCadenceShift(input);
  }

  private matchBaselineSufficiency(input: KeystrokeDynamicsInputEntity): KeystrokeBaselineProfileMatchEntity {
    const minimumBaselineSampleCount = input.minimumBaselineSampleCount ?? DEFAULT_MINIMUM_BASELINE_SAMPLE_COUNT;
    if (input.baselineMedianMs > 0 && !this.isBaselineSampleCountInsufficient(input, minimumBaselineSampleCount)) {
      return this.none();
    }

    return {
      verdict: 'monitor',
      reasonCode: 'baseline_insufficient_new_user',
      confidence: 1,
      metadata: {
        baselineMedianMs: input.baselineMedianMs,
        baselineSampleCount: input.baselineSampleCount,
        minimumBaselineSampleCount,
        skippedKeystrokeModel: true,
      },
    };
  }

  private matchInputMethod(input: KeystrokeDynamicsInputEntity): KeystrokeBaselineProfileMatchEntity {
    if (!this.hasDifferentString(input.inputMethod, input.baselineInputMethod)) return this.none();
    return {
      verdict: 'monitor',
      reasonCode: 'input_method_split_baseline',
      confidence: 1,
      metadata: {
        baselineInputMethod: input.baselineInputMethod,
        inputMethod: input.inputMethod,
        splitBaselineRequired: true,
      },
    };
  }

  private matchKeyboardLayout(input: KeystrokeDynamicsInputEntity): KeystrokeBaselineProfileMatchEntity {
    if (!this.hasDifferentString(input.keyboardLayout, input.baselineKeyboardLayout)) return this.none();
    return {
      verdict: 'monitor',
      reasonCode: 'keyboard_layout_changed_ngram_set',
      confidence: 1,
      metadata: {
        baselineKeyboardLayout: input.baselineKeyboardLayout,
        keyboardLayout: input.keyboardLayout,
        splitNgramBaselineRequired: true,
      },
    };
  }

  private matchCadenceShift(input: KeystrokeDynamicsInputEntity): KeystrokeBaselineProfileMatchEntity {
    const baselineIntervals = input.baselineIntervalsMs ?? [];
    if (input.intervalsMs.length < MINIMUM_PATTERN_SAMPLE_SIZE || baselineIntervals.length < MINIMUM_PATTERN_SAMPLE_SIZE) {
      return this.none();
    }

    const baselineMedian = this.median(baselineIntervals);
    const currentMedian = this.median(input.intervalsMs);
    if (baselineMedian <= 0 || currentMedian <= 0) return this.none();

    const scaledManhattanDistance = this.scaledManhattanDistance(input.intervalsMs, baselineIntervals);
    if (scaledManhattanDistance > PATTERN_DISTANCE_THRESHOLD) return this.none();

    const cadenceRatio = currentMedian / baselineMedian;
    if (cadenceRatio >= SLOW_CADENCE_RATIO) {
      return this.allow('local_baseline_slow_cadence_match', cadenceRatio, scaledManhattanDistance);
    }
    if (cadenceRatio <= FAST_CADENCE_RATIO) {
      return this.allow('local_baseline_fast_cadence_match', cadenceRatio, scaledManhattanDistance);
    }

    return this.none();
  }

  private allow(
    reasonCode: string,
    cadenceRatio: number,
    scaledManhattanDistance: number,
  ): KeystrokeBaselineProfileMatchEntity {
    return {
      verdict: 'allow',
      reasonCode,
      confidence: 1,
      metadata: {
        cadenceRatio: this.round(cadenceRatio),
        patternStayedLocal: true,
        scaledManhattanDistance: this.round(scaledManhattanDistance),
        threshold: PATTERN_DISTANCE_THRESHOLD,
      },
    };
  }

  private isBaselineSampleCountInsufficient(
    input: KeystrokeDynamicsInputEntity,
    minimumBaselineSampleCount: number,
  ): boolean {
    return input.baselineSampleCount !== undefined && input.baselineSampleCount < minimumBaselineSampleCount;
  }

  private hasDifferentString(left: string | undefined, right: string | undefined): boolean {
    return left !== undefined && right !== undefined && left.trim() !== '' && right.trim() !== '' && left !== right;
  }

  private scaledManhattanDistance(currentIntervals: number[], baselineIntervals: number[]): number {
    const sampleSize = Math.min(currentIntervals.length, baselineIntervals.length);
    const currentMedian = this.median(currentIntervals);
    const baselineMedian = this.median(baselineIntervals);
    const distances = currentIntervals
      .slice(0, sampleSize)
      .map((interval, index) => Math.abs((interval / currentMedian) - (baselineIntervals[index] / baselineMedian)));
    return distances.reduce((sum, value) => sum + value, 0) / distances.length;
  }

  private median(values: number[]): number {
    const sortedValues = [...values].sort((left, right) => left - right);
    const middleIndex = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 1) return sortedValues[middleIndex];
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
  }

  private none(): KeystrokeBaselineProfileMatchEntity {
    return {
      verdict: 'none',
      confidence: 0,
      metadata: {},
    };
  }

  private round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
