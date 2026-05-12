import type { RiskSignalEntity } from '../../domain/risk/entities/RiskSignalEntity';

const POINTER_STEP_UP_BOOST_CONTRIBUTION = 40;
const GENERIC_POINTER_CONFIDENCE = 0.8;
const FULL_POINTER_CONFIDENCE = 1;

const STEP_UP_REASON_CODES = new Set([
  'pointer_linear_rat_autofill',
  'pointer_exact_hit_no_hover_exploration',
  'pointer_constant_speed_automation',
  'pointer_teleport_jump',
  'pointer_smooth_bezier_bot',
  'pointer_chaotic_adversarial_bot',
]);

const MONITOR_REASON_CODES = new Set([
  'pointer_idle_drift_missing',
  'pointer_double_click_identical_duration',
  'pointer_tremor_false_positive_risk',
  'pointer_trackball_split_baseline',
  'pointer_stylus_smooth_split_baseline',
]);

const ALLOW_REASON_CODES = new Set([
  'pointer_natural_curve_micro_jitter',
  'pointer_hover_explore_click_human',
  'pointer_fitts_law_slowdown',
  'pointer_touchpad_human_pattern',
  'pointer_touch_only_not_applicable',
]);

const FULL_CONFIDENCE_REASON_CODES = new Set([
  ...STEP_UP_REASON_CODES,
  ...MONITOR_REASON_CODES,
  'click_burst_pattern',
]);

export class PointerPatternSignalBuildingService {
  build(reasonCodes: string[], metadata: Record<string, unknown> = {}): RiskSignalEntity[] {
    const normalizedReasonCodes = this.riskReasonCodes(this.uniqueNonEmpty(reasonCodes));
    if (normalizedReasonCodes.length === 0) return [];

    const signals: RiskSignalEntity[] = [
      {
        kind: 'pointer_pattern',
        detected: true,
        confidence: this.confidence(normalizedReasonCodes),
        reasonCodes: normalizedReasonCodes,
        source: this.source(normalizedReasonCodes),
        metadata,
      },
    ];

    if (normalizedReasonCodes.some((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode))) {
      signals.push({
        kind: 'composite_risk_boost',
        detected: true,
        contribution: POINTER_STEP_UP_BOOST_CONTRIBUTION,
        maxContribution: POINTER_STEP_UP_BOOST_CONTRIBUTION,
        reasonCodes: ['pointer_step_up_floor'],
        source: 'live',
        metadata: {
          ...metadata,
          matchedReasonCodes: normalizedReasonCodes.filter((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode)),
        },
      });
    }

    return signals;
  }

  private riskReasonCodes(reasonCodes: string[]): string[] {
    return reasonCodes.filter((reasonCode) => !ALLOW_REASON_CODES.has(reasonCode));
  }

  private confidence(reasonCodes: string[]): number {
    if (reasonCodes.some((reasonCode) => FULL_CONFIDENCE_REASON_CODES.has(reasonCode))) {
      return FULL_POINTER_CONFIDENCE;
    }
    return GENERIC_POINTER_CONFIDENCE;
  }

  private source(reasonCodes: string[]): RiskSignalEntity['source'] {
    if (reasonCodes.some((reasonCode) => reasonCode.startsWith('pointer_'))) return 'live';
    if (reasonCodes.length === 1 && reasonCodes[0] === 'click_burst_pattern') return 'live';
    return 'paper';
  }

  private uniqueNonEmpty(values: string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter((value, index, items) => value !== '' && items.indexOf(value) === index);
  }
}
