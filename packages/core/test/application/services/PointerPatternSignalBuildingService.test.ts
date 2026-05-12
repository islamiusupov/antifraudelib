import { describe, expect, it } from 'vitest';
import { PointerPatternSignalBuildingService } from '../../../src/application/services/PointerPatternSignalBuildingService';

describe('PointerPatternSignalBuildingService', () => {
  it.each([
    'pointer_linear_rat_autofill',
    'pointer_exact_hit_no_hover_exploration',
    'pointer_constant_speed_automation',
    'pointer_teleport_jump',
    'pointer_smooth_bezier_bot',
    'pointer_chaotic_adversarial_bot',
  ])('adds a step-up boost for %s', (reasonCode) => {
    const service = new PointerPatternSignalBuildingService();

    expect(service.build([reasonCode], { sampleCount: 8 })).toEqual([
      expect.objectContaining({
        kind: 'pointer_pattern',
        confidence: 1,
        reasonCodes: [reasonCode],
        metadata: { sampleCount: 8 },
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 40,
        maxContribution: 40,
        reasonCodes: ['pointer_step_up_floor'],
        metadata: {
          sampleCount: 8,
          matchedReasonCodes: [reasonCode],
        },
      }),
    ]);
  });

  it.each([
    'pointer_idle_drift_missing',
    'pointer_double_click_identical_duration',
    'pointer_tremor_false_positive_risk',
    'pointer_trackball_split_baseline',
    'pointer_stylus_smooth_split_baseline',
  ])('keeps %s at monitor strength without a boost', (reasonCode) => {
    const service = new PointerPatternSignalBuildingService();

    expect(service.build([reasonCode])).toEqual([
      expect.objectContaining({
        kind: 'pointer_pattern',
        confidence: 1,
        reasonCodes: [reasonCode],
      }),
    ]);
  });

  it.each([
    'pointer_natural_curve_micro_jitter',
    'pointer_hover_explore_click_human',
    'pointer_fitts_law_slowdown',
    'pointer_touchpad_human_pattern',
    'pointer_touch_only_not_applicable',
  ])('keeps allow reason %s out of risk signals', (reasonCode) => {
    const service = new PointerPatternSignalBuildingService();

    expect(service.build([reasonCode])).toEqual([]);
  });

  it('preserves generic pointer anomaly confidence for legacy events', () => {
    const service = new PointerPatternSignalBuildingService();

    expect(service.build(['pointer_pattern_anomaly'])).toEqual([
      expect.objectContaining({
        kind: 'pointer_pattern',
        confidence: 0.8,
        reasonCodes: ['pointer_pattern_anomaly'],
      }),
    ]);
  });

  it('keeps click bursts at full pointer strength without a step-up boost', () => {
    const service = new PointerPatternSignalBuildingService();

    expect(service.build(['click_burst_pattern'])).toEqual([
      expect.objectContaining({
        kind: 'pointer_pattern',
        confidence: 1,
        reasonCodes: ['click_burst_pattern'],
      }),
    ]);
  });
});
