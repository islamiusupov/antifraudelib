import { describe, expect, it } from 'vitest';
import { KeystrokeDynamicsSignalBuildingService } from '../../../src/application/services/KeystrokeDynamicsSignalBuildingService';

describe('KeystrokeDynamicsSignalBuildingService', () => {
  it.each([
    'long_keystroke_pause_instruction_pattern',
    'uniform_keystroke_interval_automation',
    'short_key_hold_time_automation',
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
