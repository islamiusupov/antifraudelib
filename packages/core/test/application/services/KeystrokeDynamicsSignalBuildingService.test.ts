import { describe, expect, it } from 'vitest';
import { KeystrokeDynamicsSignalBuildingService } from '../../../src/application/services/KeystrokeDynamicsSignalBuildingService';

describe('KeystrokeDynamicsSignalBuildingService', () => {
  it.each([
    'long_keystroke_pause_instruction_pattern',
    'ngram_profile_mismatch',
    'uniform_keystroke_interval_automation',
    'short_key_hold_time_automation',
    'bimodal_inter_key_timing',
  ])('adds a step-up boost for %s', (reasonCode) => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build([reasonCode], { sampleCount: 4 })).toEqual([
      expect.objectContaining({
        kind: 'keystroke_dynamics',
        confidence: 1,
        reasonCodes: [reasonCode],
        metadata: { sampleCount: 4 },
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 30,
        maxContribution: 30,
        reasonCodes: ['keystroke_step_up_floor'],
        metadata: {
          sampleCount: 4,
          matchedReasonCodes: [reasonCode],
        },
      }),
    ]);
  });

  it('adds a step-up boost for high-confidence ONNX not-user verdicts', () => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build(['onnx_not_user_high_confidence'], { confidence: 0.91, verdict: 'not_user' }))
      .toEqual([
        expect.objectContaining({
          kind: 'keystroke_dynamics',
          confidence: 1,
          reasonCodes: ['onnx_not_user_high_confidence'],
        }),
        expect.objectContaining({
          kind: 'composite_risk_boost',
          contribution: 30,
          reasonCodes: ['keystroke_step_up_floor'],
        }),
      ]);
  });

  it('ignores ONNX not-user verdicts below the strict confidence threshold', () => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build(['onnx_not_user_high_confidence'], { confidence: 0.9, verdict: 'not_user' }))
      .toEqual([]);
  });

  it('matches ONNX confidence to the same observation reason code', () => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build(['onnx_not_user_high_confidence', 'onnx_user_match_high_confidence'], {
      observations: [
        { confidence: 0.89, reason: 'onnx_not_user_high_confidence' },
        { confidence: 0.99, reason: 'onnx_user_match_high_confidence' },
      ],
    })).toEqual([]);
  });

  it('adds a blocking boost for Selenium SendKeys signatures', () => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build(['selenium_sendkeys_signature'])).toEqual([
      expect.objectContaining({
        kind: 'keystroke_dynamics',
        confidence: 1,
        reasonCodes: ['selenium_sendkeys_signature'],
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 55,
        maxContribution: 55,
        reasonCodes: ['keystroke_block_floor'],
      }),
    ]);
  });

  it.each([
    ['local_baseline_scaled_manhattan_match', { scaledManhattanDistance: 0.12, threshold: 0.75 }],
    ['onnx_user_match_high_confidence', { confidence: 0.86, verdict: 'match' }],
  ])('keeps allow reason %s out of risk signals', (reasonCode, metadata) => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build([reasonCode], metadata)).toEqual([]);
  });

  it('keeps missing typing corrections at monitor strength without a step-up boost', () => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build(['missing_typing_corrections'])).toEqual([
      expect.objectContaining({
        kind: 'keystroke_dynamics',
        confidence: 1,
        reasonCodes: ['missing_typing_corrections'],
      }),
    ]);
  });

  it('keeps generic keystroke anomalies below monitor strength', () => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build(['keystroke_dynamics_anomaly'])).toEqual([
      expect.objectContaining({
        kind: 'keystroke_dynamics',
        confidence: 0.8,
        reasonCodes: ['keystroke_dynamics_anomaly'],
      }),
    ]);
  });

  it('drops empty and duplicate reason codes', () => {
    const service = new KeystrokeDynamicsSignalBuildingService();

    expect(service.build([' ', 'missing_typing_corrections', 'missing_typing_corrections']))
      .toEqual([
        expect.objectContaining({
          reasonCodes: ['missing_typing_corrections'],
        }),
      ]);
  });
});
