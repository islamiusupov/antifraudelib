import { describe, expect, it } from 'vitest';
import { KeystrokeDynamicsClassifyingService } from '../../../src/application/services/KeystrokeDynamicsClassifyingService';

describe('KeystrokeDynamicsClassifyingService', () => {
  it('monitors new users with insufficient baseline instead of running anomaly scoring', () => {
    const service = new KeystrokeDynamicsClassifyingService();

    expect(
      service.classify({
        intervalsMs: [120, 130, 125, 135],
        baselineMedianMs: 125,
        baselineSampleCount: 1,
      }),
    ).toMatchObject({
      kind: 'keystroke_dynamics',
      detected: true,
      confidence: 1,
      reasonCodes: ['baseline_insufficient_new_user'],
      source: 'live',
      metadata: {
        skippedKeystrokeModel: true,
      },
    });
  });

  it.each([
    {
      expectedReasonCode: 'local_baseline_slow_cadence_match',
      intervalsMs: [160, 320, 160, 320],
    },
    {
      expectedReasonCode: 'local_baseline_fast_cadence_match',
      intervalsMs: [60, 120, 60, 120],
    },
  ])('allows cadence shifts when the pattern remains local: $expectedReasonCode', ({ expectedReasonCode, intervalsMs }) => {
    const service = new KeystrokeDynamicsClassifyingService();

    expect(
      service.classify({
        intervalsMs,
        baselineIntervalsMs: [100, 200, 100, 200],
        baselineMedianMs: 150,
      }),
    ).toMatchObject({
      kind: 'keystroke_dynamics',
      detected: false,
      confidence: 0,
      reasonCodes: [expectedReasonCode],
      source: 'live',
      metadata: {
        patternStayedLocal: true,
      },
    });
  });

  it.each([
    {
      expectedReasonCode: 'input_method_split_baseline',
      input: {
        inputMethod: 'phone',
        baselineInputMethod: 'keyboard',
      },
    },
    {
      expectedReasonCode: 'keyboard_layout_changed_ngram_set',
      input: {
        keyboardLayout: 'ru',
        baselineKeyboardLayout: 'en',
      },
    },
  ])('monitors split baseline edge case: $expectedReasonCode', ({ expectedReasonCode, input }) => {
    const service = new KeystrokeDynamicsClassifyingService();

    expect(
      service.classify({
        intervalsMs: [120, 130, 125, 135],
        baselineMedianMs: 125,
        ...input,
      }),
    ).toMatchObject({
      kind: 'keystroke_dynamics',
      detected: true,
      confidence: 1,
      reasonCodes: [expectedReasonCode],
      source: 'live',
    });
  });

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
