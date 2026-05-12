import type { RiskSignalEntity } from '../../domain/risk/entities/RiskSignalEntity';

const KEYSTROKE_STEP_UP_BOOST_CONTRIBUTION = 30;
const GENERIC_KEYSTROKE_CONFIDENCE = 0.8;
const FULL_KEYSTROKE_CONFIDENCE = 1;

const STEP_UP_REASON_CODES = new Set([
  'fast_key_burst',
  'long_keystroke_pause_instruction_pattern',
  'uniform_keystroke_interval_automation',
  'short_key_hold_time_automation',
]);

const FULL_CONFIDENCE_REASON_CODES = new Set([
  ...STEP_UP_REASON_CODES,
  'missing_typing_corrections',
]);

export class KeystrokeDynamicsSignalBuildingService {
  build(reasonCodes: string[], metadata: Record<string, unknown> = {}): RiskSignalEntity[] {
    const normalizedReasonCodes = this.uniqueNonEmpty(reasonCodes);
    if (normalizedReasonCodes.length === 0) return [];

    const signals: RiskSignalEntity[] = [
      {
        kind: 'keystroke_dynamics',
        detected: true,
        confidence: this.confidence(normalizedReasonCodes),
        reasonCodes: normalizedReasonCodes,
        source: 'live',
        metadata,
      },
    ];

    if (normalizedReasonCodes.some((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode))) {
      signals.push({
        kind: 'composite_risk_boost',
        detected: true,
        contribution: KEYSTROKE_STEP_UP_BOOST_CONTRIBUTION,
        maxContribution: KEYSTROKE_STEP_UP_BOOST_CONTRIBUTION,
        reasonCodes: ['keystroke_step_up_floor'],
        source: 'live',
        metadata: {
          ...metadata,
          matchedReasonCodes: normalizedReasonCodes.filter((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode)),
        },
      });
    }

    return signals;
  }

  private confidence(reasonCodes: string[]): number {
    if (reasonCodes.some((reasonCode) => FULL_CONFIDENCE_REASON_CODES.has(reasonCode))) {
      return FULL_KEYSTROKE_CONFIDENCE;
    }
    return GENERIC_KEYSTROKE_CONFIDENCE;
  }

  private uniqueNonEmpty(values: string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter((value, index, items) => value !== '' && items.indexOf(value) === index);
  }
}
