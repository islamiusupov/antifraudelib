import { describe, expect, it } from 'vitest';
import { KeystrokeBaselineProfileMatchingService } from '../../../src/application/services/KeystrokeBaselineProfileMatchingService';

describe('KeystrokeBaselineProfileMatchingService', () => {
  it('monitors new users when baseline samples are insufficient', () => {
    const service = new KeystrokeBaselineProfileMatchingService();

    expect(service.match({
      intervalsMs: [120, 130, 125, 135],
      baselineMedianMs: 125,
      baselineSampleCount: 2,
      minimumBaselineSampleCount: 5,
    })).toEqual({
      verdict: 'monitor',
      reasonCode: 'baseline_insufficient_new_user',
      confidence: 1,
      metadata: {
        baselineMedianMs: 125,
        baselineSampleCount: 2,
        minimumBaselineSampleCount: 5,
        skippedKeystrokeModel: true,
      },
    });
  });

  it('allows slower cadence when the scaled timing shape still matches the local baseline', () => {
    const service = new KeystrokeBaselineProfileMatchingService();

    expect(service.match({
      intervalsMs: [160, 320, 160, 320],
      baselineIntervalsMs: [100, 200, 100, 200],
      baselineMedianMs: 150,
    })).toEqual({
      verdict: 'allow',
      reasonCode: 'local_baseline_slow_cadence_match',
      confidence: 1,
      metadata: {
        cadenceRatio: 1.6,
        patternStayedLocal: true,
        scaledManhattanDistance: 0,
        threshold: 0.2,
      },
    });
  });

  it('allows faster cadence when the scaled timing shape still matches the local baseline', () => {
    const service = new KeystrokeBaselineProfileMatchingService();

    expect(service.match({
      intervalsMs: [60, 120, 60, 120],
      baselineIntervalsMs: [100, 200, 100, 200],
      baselineMedianMs: 150,
    })).toMatchObject({
      verdict: 'allow',
      reasonCode: 'local_baseline_fast_cadence_match',
      metadata: {
        cadenceRatio: 0.6,
        scaledManhattanDistance: 0,
      },
    });
  });

  it('monitors input method changes so keyboard and phone baselines split', () => {
    const service = new KeystrokeBaselineProfileMatchingService();

    expect(service.match({
      intervalsMs: [120, 130, 125, 135],
      baselineMedianMs: 125,
      inputMethod: 'phone',
      baselineInputMethod: 'keyboard',
    })).toMatchObject({
      verdict: 'monitor',
      reasonCode: 'input_method_split_baseline',
      metadata: {
        splitBaselineRequired: true,
      },
    });
  });

  it('monitors keyboard layout changes as a separate ngram baseline', () => {
    const service = new KeystrokeBaselineProfileMatchingService();

    expect(service.match({
      intervalsMs: [120, 130, 125, 135],
      baselineMedianMs: 125,
      keyboardLayout: 'ru',
      baselineKeyboardLayout: 'en',
    })).toMatchObject({
      verdict: 'monitor',
      reasonCode: 'keyboard_layout_changed_ngram_set',
      metadata: {
        splitNgramBaselineRequired: true,
      },
    });
  });

  it('does not match cadence allow when the scaled timing shape changes too much', () => {
    const service = new KeystrokeBaselineProfileMatchingService();

    expect(service.match({
      intervalsMs: [160, 160, 320, 320],
      baselineIntervalsMs: [100, 200, 100, 200],
      baselineMedianMs: 150,
    })).toEqual({
      verdict: 'none',
      confidence: 0,
      metadata: {},
    });
  });
});
