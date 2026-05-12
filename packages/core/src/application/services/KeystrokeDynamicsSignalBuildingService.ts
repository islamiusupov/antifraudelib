import type { RiskSignalEntity } from '../../domain/risk/entities/RiskSignalEntity';

const KEYSTROKE_STEP_UP_BOOST_CONTRIBUTION = 30;
const KEYSTROKE_BLOCK_BOOST_CONTRIBUTION = 55;
const GENERIC_KEYSTROKE_CONFIDENCE = 0.8;
const FULL_KEYSTROKE_CONFIDENCE = 1;
const ONNX_NOT_USER_MINIMUM_CONFIDENCE = 0.9;

const STEP_UP_REASON_CODES = new Set([
  'fast_key_burst',
  'long_keystroke_pause_instruction_pattern',
  'ngram_profile_mismatch',
  'uniform_keystroke_interval_automation',
  'short_key_hold_time_automation',
  'bimodal_inter_key_timing',
  'onnx_not_user_high_confidence',
]);

const BLOCK_REASON_CODES = new Set([
  'selenium_sendkeys_signature',
]);

const ALLOW_REASON_CODES = new Set([
  'local_baseline_scaled_manhattan_match',
  'onnx_user_match_high_confidence',
]);

const FULL_CONFIDENCE_REASON_CODES = new Set([
  ...STEP_UP_REASON_CODES,
  ...BLOCK_REASON_CODES,
  'missing_typing_corrections',
]);

export class KeystrokeDynamicsSignalBuildingService {
  build(reasonCodes: string[], metadata: Record<string, unknown> = {}): RiskSignalEntity[] {
    const normalizedReasonCodes = this.riskReasonCodes(this.uniqueNonEmpty(reasonCodes), metadata);
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

    if (normalizedReasonCodes.some((reasonCode) => BLOCK_REASON_CODES.has(reasonCode))) {
      signals.push({
        kind: 'composite_risk_boost',
        detected: true,
        contribution: KEYSTROKE_BLOCK_BOOST_CONTRIBUTION,
        maxContribution: KEYSTROKE_BLOCK_BOOST_CONTRIBUTION,
        reasonCodes: ['keystroke_block_floor'],
        source: 'live',
        metadata: {
          ...metadata,
          matchedReasonCodes: normalizedReasonCodes.filter((reasonCode) => BLOCK_REASON_CODES.has(reasonCode)),
        },
      });
    } else if (normalizedReasonCodes.some((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode))) {
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

  private riskReasonCodes(reasonCodes: string[], metadata: Record<string, unknown>): string[] {
    return reasonCodes.filter((reasonCode) => this.isRiskReasonCode(reasonCode, metadata));
  }

  private isRiskReasonCode(reasonCode: string, metadata: Record<string, unknown>): boolean {
    if (reasonCode === 'onnx_not_user_high_confidence') {
      return this.maximumMetadataNumberForReason(reasonCode, metadata, ['confidence', 'modelConfidence', 'onnxConfidence']) >
        ONNX_NOT_USER_MINIMUM_CONFIDENCE;
    }
    if (reasonCode === 'onnx_user_match_high_confidence') {
      return false;
    }
    return !ALLOW_REASON_CODES.has(reasonCode);
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

  private maximumMetadataNumberForReason(
    reasonCode: string,
    metadata: Record<string, unknown>,
    keys: string[],
  ): number {
    const observations = this.metadataObservations(metadata);
    const values = observations.length === 0 || this.metadataHasReasonCode(metadata, reasonCode)
      ? this.metadataNumbers(metadata, keys)
      : [];
    observations.forEach((observation) => {
      if (this.metadataHasReasonCode(observation, reasonCode)) {
        values.push(...this.metadataNumbers(observation, keys));
      }
    });
    return values.length > 0 ? Math.max(...values) : 0;
  }

  private metadataObservations(metadata: Record<string, unknown>): Record<string, unknown>[] {
    const observations = metadata.observations;
    if (!Array.isArray(observations)) return [];
    return observations.filter((observation): observation is Record<string, unknown> => this.isMetadataRecord(observation));
  }

  private metadataNumbers(metadata: Record<string, unknown>, keys: string[]): number[] {
    return keys
      .map((key) => metadata[key])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  }

  private isMetadataRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private metadataHasReasonCode(metadata: Record<string, unknown>, reasonCode: string): boolean {
    if (metadata.reason === reasonCode) return true;
    const reasonCodes = metadata.reasonCodes;
    return Array.isArray(reasonCodes) && reasonCodes.includes(reasonCode);
  }
}
