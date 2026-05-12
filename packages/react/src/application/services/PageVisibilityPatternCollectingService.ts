import type { LiveInteractionTargetEntity } from '../../domain/live/entities/LiveInteractionTargetEntity';

type PageVisibilityActionKind = 'confirm_click' | 'recipient_pasted' | 'amount_pasted' | 'input' | 'keydown';

export type PageVisibilityPatternCollectingState = {
  hiddenSinceMs?: number;
  lastHiddenDurationMs?: number;
  lastReturnAtMs?: number;
  lastExitSource?: string;
  exitTimesMs: number[];
  shortBlurTimesMs: number[];
  paymentActivityTimesMs: number[];
  returnActionCycleTimesMs: number[];
  actionsAfterReturnCount: number;
  hasActionSinceLastReturn: boolean;
  isHidden: boolean;
  emittedReasonCodes: Set<string>;
};

type PageVisibilityPatternContext = {
  target?: LiveInteractionTargetEntity;
  source?: string;
};

const PAGE_LOAD_ALLOW_WINDOW_MS = 5000;
const PUSH_NOTIFICATION_BLUR_MAX_MS = 2500;
const OS_POPUP_BLUR_MAX_MS = 1000;
const SHORT_BLUR_MIN_MS = 3000;
const SHORT_BLUR_MAX_MS = 5000;
const SHORT_BLUR_MINIMUM_COUNT = 3;
const FREQUENT_EXIT_WINDOW_MS = 2 * 60 * 1000;
const FREQUENT_EXIT_MINIMUM_COUNT = 5;
const OSCILLATION_WINDOW_MS = 5 * 60 * 1000;
const OSCILLATION_BLOCK_MINIMUM_COUNT = 8;
const RETURN_ACTION_WINDOW_MS = 5000;
const RETURN_CONTINUATION_WINDOW_MS = 10000;
const CONFIRM_EXIT_MIN_MS = 45000;
const WHATSAPP_EXIT_MIN_MS = 30000;
const LONG_ABSENCE_MS = 5 * 60 * 1000;
const LONG_ABSENCE_FAST_ACTION_MINIMUM_COUNT = 2;
const PAYMENT_TEXT_PATTERN = /(recipient|beneficiary|receiver|iban|bic|swift|account|card|phone|bank|holder|amount|sum|total|payment|transfer|confirm|submit|pay)/i;

export class PageVisibilityPatternCollectingService {
  createState(): PageVisibilityPatternCollectingState {
    return {
      exitTimesMs: [],
      shortBlurTimesMs: [],
      paymentActivityTimesMs: [],
      returnActionCycleTimesMs: [],
      actionsAfterReturnCount: 0,
      hasActionSinceLastReturn: false,
      isHidden: false,
      emittedReasonCodes: new Set<string>(),
    };
  }

  recordPaymentFormActivity(state: PageVisibilityPatternCollectingState, atMs: number): void {
    state.paymentActivityTimesMs = [
      ...this.recentTimes(state.paymentActivityTimesMs, atMs, OSCILLATION_WINDOW_MS),
      atMs,
    ];
  }

  collectExitMetadata(
    state: PageVisibilityPatternCollectingState,
    atMs: number,
    context: PageVisibilityPatternContext = {},
  ): Record<string, unknown> {
    if (!state.isHidden) {
      state.hiddenSinceMs = atMs;
      state.isHidden = true;
      state.hasActionSinceLastReturn = false;
      state.actionsAfterReturnCount = 0;
      state.lastExitSource = context.source;
      state.exitTimesMs = [
        ...this.recentTimes(state.exitTimesMs, atMs, OSCILLATION_WINDOW_MS),
        atMs,
      ];
    }

    const reasonCodes = this.exitReasonCodes(state, atMs);
    return this.metadata(state, atMs, reasonCodes, context);
  }

  collectReturnMetadata(
    state: PageVisibilityPatternCollectingState,
    atMs: number,
    context: PageVisibilityPatternContext = {},
  ): Record<string, unknown> {
    const hiddenDurationMs = state.hiddenSinceMs === undefined ? 0 : atMs - state.hiddenSinceMs;
    state.lastHiddenDurationMs = hiddenDurationMs;
    state.lastReturnAtMs = atMs;
    state.hiddenSinceMs = undefined;
    state.isHidden = false;
    state.actionsAfterReturnCount = 0;
    state.hasActionSinceLastReturn = false;

    if (hiddenDurationMs >= SHORT_BLUR_MIN_MS && hiddenDurationMs <= SHORT_BLUR_MAX_MS) {
      state.shortBlurTimesMs = [
        ...this.recentTimes(state.shortBlurTimesMs, atMs, FREQUENT_EXIT_WINDOW_MS),
        atMs,
      ];
    } else {
      state.shortBlurTimesMs = this.recentTimes(state.shortBlurTimesMs, atMs, FREQUENT_EXIT_WINDOW_MS);
    }

    const reasonCodes = this.returnReasonCodes(state, atMs, context);
    return this.metadata(state, atMs, reasonCodes, context);
  }

  collectActionMetadata(
    state: PageVisibilityPatternCollectingState,
    actionKind: PageVisibilityActionKind,
    atMs: number,
    context: PageVisibilityPatternContext = {},
  ): Record<string, unknown> | null {
    if (state.lastReturnAtMs === undefined) return null;

    const returnToActionMs = atMs - state.lastReturnAtMs;
    if (returnToActionMs > RETURN_CONTINUATION_WINDOW_MS) return null;

    state.actionsAfterReturnCount += 1;
    if (!state.hasActionSinceLastReturn) {
      state.hasActionSinceLastReturn = true;
      state.returnActionCycleTimesMs = [
        ...this.recentTimes(state.returnActionCycleTimesMs, atMs, OSCILLATION_WINDOW_MS),
        atMs,
      ];
    }

    const reasonCodes = this.actionReasonCodes(state, actionKind, returnToActionMs);
    const newReasonCodes = this.newReasonCodes(state, reasonCodes);
    if (newReasonCodes.length === 0) return null;

    return this.metadata(state, atMs, newReasonCodes, {
      ...context,
      source: actionKind,
    }, returnToActionMs);
  }

  isPaymentFormTarget(targetText: string): boolean {
    return PAYMENT_TEXT_PATTERN.test(targetText);
  }

  private exitReasonCodes(state: PageVisibilityPatternCollectingState, atMs: number): string[] {
    const exitCount2m = this.exitCount(state, atMs, FREQUENT_EXIT_WINDOW_MS);
    const exitCount5m = this.exitCount(state, atMs, OSCILLATION_WINDOW_MS);
    if (atMs <= PAGE_LOAD_ALLOW_WINDOW_MS && !this.hasRecentPaymentActivity(state, atMs, PAGE_LOAD_ALLOW_WINDOW_MS)) {
      return ['minimized_during_page_load'];
    }
    if (exitCount5m >= OSCILLATION_BLOCK_MINIMUM_COUNT) {
      return this.hasRecentPaymentActivity(state, atMs, OSCILLATION_WINDOW_MS)
        ? ['page_visibility_oscillation_block']
        : ['multitasker_many_tabs_monitor'];
    }
    if (exitCount2m >= FREQUENT_EXIT_MINIMUM_COUNT && this.hasRecentPaymentActivity(state, atMs, FREQUENT_EXIT_WINDOW_MS)) {
      return ['frequent_page_exits_during_payment_form'];
    }
    if (exitCount5m >= FREQUENT_EXIT_MINIMUM_COUNT && !this.hasRecentPaymentActivity(state, atMs, OSCILLATION_WINDOW_MS)) {
      return ['multitasker_many_tabs_monitor'];
    }
    return [];
  }

  private returnReasonCodes(
    state: PageVisibilityPatternCollectingState,
    atMs: number,
    context: PageVisibilityPatternContext,
  ): string[] {
    const hiddenDurationMs = state.lastHiddenDurationMs ?? 0;
    const exitReasonCodes = this.exitReasonCodes(state, atMs);
    if (exitReasonCodes.length > 0) return exitReasonCodes;

    if (hiddenDurationMs > LONG_ABSENCE_MS) return ['long_idle_without_switching_pattern'];
    if (this.isMobileContext(context.target) && state.shortBlurTimesMs.length >= SHORT_BLUR_MINIMUM_COUNT) {
      return ['mobile_notification_blur_monitor'];
    }
    if (state.shortBlurTimesMs.length >= SHORT_BLUR_MINIMUM_COUNT) {
      return ['short_blur_instruction_pattern'];
    }
    if (hiddenDurationMs > 0 && hiddenDurationMs <= OS_POPUP_BLUR_MAX_MS) return ['os_popup_focus_loss'];
    if (hiddenDurationMs > 0 && hiddenDurationMs <= PUSH_NOTIFICATION_BLUR_MAX_MS) {
      return ['single_short_push_notification_blur'];
    }
    return [];
  }

  private actionReasonCodes(
    state: PageVisibilityPatternCollectingState,
    actionKind: PageVisibilityActionKind,
    returnToActionMs: number,
  ): string[] {
    const hiddenDurationMs = state.lastHiddenDurationMs ?? 0;
    const reasonCodes: string[] = [];

    if (
      actionKind === 'recipient_pasted' &&
      hiddenDurationMs >= SHORT_BLUR_MIN_MS &&
      returnToActionMs <= RETURN_ACTION_WINDOW_MS
    ) {
      reasonCodes.push('return_paste_iban_after_exit');
    }
    if (
      hiddenDurationMs > LONG_ABSENCE_MS &&
      state.actionsAfterReturnCount >= LONG_ABSENCE_FAST_ACTION_MINIMUM_COUNT &&
      returnToActionMs <= RETURN_CONTINUATION_WINDOW_MS
    ) {
      reasonCodes.push('long_absence_fast_action_sequence');
    }
    if (
      actionKind === 'confirm_click' &&
      hiddenDurationMs >= CONFIRM_EXIT_MIN_MS &&
      returnToActionMs <= RETURN_ACTION_WINDOW_MS
    ) {
      reasonCodes.push('return_confirm_immediate_after_45s_exit');
    }
    if (
      hiddenDurationMs >= WHATSAPP_EXIT_MIN_MS &&
      hiddenDurationMs < CONFIRM_EXIT_MIN_MS &&
      returnToActionMs <= RETURN_CONTINUATION_WINDOW_MS
    ) {
      reasonCodes.push('whatsapp_tab_instruction_return');
    }
    if (state.returnActionCycleTimesMs.length >= 2) {
      reasonCodes.push('blur_action_repeated_instruction_pattern');
    }

    return reasonCodes;
  }

  private metadata(
    state: PageVisibilityPatternCollectingState,
    atMs: number,
    reasonCodes: string[],
    context: PageVisibilityPatternContext,
    returnToActionMs?: number,
  ): Record<string, unknown> {
    return {
      ...(reasonCodes.length > 0 ? { reason: reasonCodes[0], reasonCodes } : {}),
      source: context.source,
      hiddenDurationMs: state.lastHiddenDurationMs,
      returnToActionMs,
      exitCount2m: this.exitCount(state, atMs, FREQUENT_EXIT_WINDOW_MS),
      exitCount5m: this.exitCount(state, atMs, OSCILLATION_WINDOW_MS),
      shortBlurCount: state.shortBlurTimesMs.length,
      paymentFormActivity: this.hasRecentPaymentActivity(state, atMs, FREQUENT_EXIT_WINDOW_MS),
      mobileContext: this.isMobileContext(context.target),
    };
  }

  private newReasonCodes(state: PageVisibilityPatternCollectingState, reasonCodes: string[]): string[] {
    const newReasonCodes = reasonCodes.filter((reasonCode) => !state.emittedReasonCodes.has(reasonCode));
    newReasonCodes.forEach((reasonCode) => state.emittedReasonCodes.add(reasonCode));
    return newReasonCodes;
  }

  private exitCount(state: PageVisibilityPatternCollectingState, atMs: number, windowMs: number): number {
    return this.recentTimes(state.exitTimesMs, atMs, windowMs).length;
  }

  private hasRecentPaymentActivity(
    state: PageVisibilityPatternCollectingState,
    atMs: number,
    windowMs: number,
  ): boolean {
    return this.recentTimes(state.paymentActivityTimesMs, atMs, windowMs).length > 0;
  }

  private recentTimes(times: number[], atMs: number, windowMs: number): number[] {
    return times.filter((timeMs) => atMs - timeMs <= windowMs);
  }

  private isMobileContext(target: LiveInteractionTargetEntity | undefined): boolean {
    const navigator = target?.navigator;
    if ((navigator?.maxTouchPoints ?? 0) > 0) return true;
    return /Android|iPhone|iPad|Mobile/i.test(navigator?.userAgent ?? '');
  }
}
