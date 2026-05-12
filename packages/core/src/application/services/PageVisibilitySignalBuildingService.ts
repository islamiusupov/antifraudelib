import type { RiskSignalEntity } from '../../domain/risk/entities/RiskSignalEntity';

const PAGE_VISIBILITY_STEP_UP_BOOST_CONTRIBUTION = 35;
const PAGE_VISIBILITY_BLOCK_BOOST_CONTRIBUTION = 60;
const PAGE_VISIBILITY_MONITOR_CONFIDENCE = 0.8;
const PAGE_VISIBILITY_FULL_CONFIDENCE = 1;

const STEP_UP_REASON_CODES = new Set([
  'page_visibility_oscillation',
  'frequent_page_exits_during_payment_form',
  'return_confirm_immediate_after_45s_exit',
  'whatsapp_tab_instruction_return',
  'long_absence_fast_action_sequence',
  'short_blur_instruction_pattern',
  'blur_action_repeated_instruction_pattern',
]);

const BLOCK_REASON_CODES = new Set([
  'page_visibility_oscillation_block',
  'return_paste_iban_after_exit',
]);

const MONITOR_REASON_CODES = new Set([
  'mobile_notification_blur_monitor',
  'multitasker_many_tabs_monitor',
  'bank_instruction_tab_reference',
]);

const ALLOW_REASON_CODES = new Set([
  'single_short_push_notification_blur',
  'long_idle_without_switching_pattern',
  'minimized_during_page_load',
  'smooth_visibility_normal_pattern',
  'single_blur_session',
  'os_popup_focus_loss',
]);

export class PageVisibilitySignalBuildingService {
  build(reasonCodes: string[], metadata: Record<string, unknown> = {}): RiskSignalEntity[] {
    const normalizedReasonCodes = this.riskReasonCodes(this.uniqueNonEmpty(reasonCodes));
    if (normalizedReasonCodes.length === 0) return [];

    const pageVisibilitySignal: RiskSignalEntity = {
      kind: 'page_visibility',
      detected: true,
      confidence: this.confidence(normalizedReasonCodes),
      reasonCodes: normalizedReasonCodes,
      source: 'live',
      metadata,
    };

    const blockReasonCodes = normalizedReasonCodes.filter((reasonCode) => BLOCK_REASON_CODES.has(reasonCode));
    if (blockReasonCodes.length > 0) {
      return [
        pageVisibilitySignal,
        this.boostSignal(PAGE_VISIBILITY_BLOCK_BOOST_CONTRIBUTION, blockReasonCodes, metadata),
      ];
    }

    const stepUpReasonCodes = normalizedReasonCodes.filter((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode));
    if (stepUpReasonCodes.length > 0) {
      return [
        pageVisibilitySignal,
        this.boostSignal(PAGE_VISIBILITY_STEP_UP_BOOST_CONTRIBUTION, stepUpReasonCodes, metadata),
      ];
    }

    return [pageVisibilitySignal];
  }

  private riskReasonCodes(reasonCodes: string[]): string[] {
    return reasonCodes.filter((reasonCode) => !ALLOW_REASON_CODES.has(reasonCode));
  }

  private confidence(reasonCodes: string[]): number {
    if (reasonCodes.some((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode) || BLOCK_REASON_CODES.has(reasonCode))) {
      return PAGE_VISIBILITY_FULL_CONFIDENCE;
    }
    if (reasonCodes.some((reasonCode) => MONITOR_REASON_CODES.has(reasonCode))) {
      return PAGE_VISIBILITY_MONITOR_CONFIDENCE;
    }
    return PAGE_VISIBILITY_MONITOR_CONFIDENCE;
  }

  private boostSignal(
    contribution: number,
    reasonCodes: string[],
    metadata: Record<string, unknown>,
  ): RiskSignalEntity {
    return {
      kind: 'composite_risk_boost',
      detected: true,
      contribution,
      maxContribution: contribution,
      reasonCodes,
      source: 'live',
      metadata: {
        ...metadata,
        matchedReasonCodes: reasonCodes,
      },
    };
  }

  private uniqueNonEmpty(values: string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter((value, index, items) => value !== '' && items.indexOf(value) === index);
  }
}
