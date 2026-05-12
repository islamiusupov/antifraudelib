import { PhishingUrlPatternMatchingService } from '@deepcode/antifraud-core';
import type { LiveInteractionCollectingConfigEntity } from '../../domain/live/entities/LiveInteractionCollectingConfigEntity';
import type { PointerPatternVerdictEntity } from '../../domain/live/entities/PointerPatternVerdictEntity';
import type { LiveInteractionDomEventEntity, LiveInteractionTargetEntity } from '../../domain/live/entities/LiveInteractionTargetEntity';
import { FieldInputCollectingService } from './FieldInputCollectingService';
import { KeystrokeInteractionCollectingService } from './KeystrokeInteractionCollectingService';
import {
  PageVisibilityPatternCollectingService,
  type PageVisibilityPatternCollectingState,
} from './PageVisibilityPatternCollectingService';
import { PhishingTextPatternMatchingService } from './PhishingTextPatternMatchingService';
import { PointerMovementCollectingService } from './PointerMovementCollectingService';
import { SpeechTranscriptCollectingService } from './SpeechTranscriptCollectingService';

type UninstallingLiveInteractionCollection = () => void;
type FieldInputTrackingState = {
  keyCount: number;
  previousValue: string;
  lastRecipientPasteValue?: string;
  lastAmountPasteValue?: string;
};
type RecipientBulkFillRecord = {
  fieldKey: string;
  atMs: number;
};
type RecipientBulkFillTrackingState = {
  records: RecipientBulkFillRecord[];
};

const AUTH_FIELD_PATTERN = /(auth|credential|login|log-in|signin|sign-in|password|passwd|username|user-name|email|e-mail|otp|one[-_\s]?time[-_\s]?code)/i;
const AUTH_AUTOCOMPLETE_PATTERN = /^(username|current-password|new-password|one-time-code)$/i;

const AMOUNT_FIELD_PATTERN = /(amount|sum|total|price|payment|rub|ruble|₽|сумм|руб)/i;
const RECIPIENT_BULK_FIELD_PATTERN = /(recipient|beneficiary|receiver|iban|bic|bik|swift|account|card|phone|bank|holder|inn|получател|счет|счёт|карта|телефон|бик|банк)/i;
const RECIPIENT_FIELD_PATTERN = /(recipient|beneficiary|iban|account|card|phone|получател|счет|счёт|карта|телефон)/i;
const CONFIRM_TEXT_PATTERN = /(confirm|continue|submit|pay|transfer|подтверд|продолж|перевести|отправ)/i;
const DEFAULT_RAPID_SCROLL_WINDOW_MS = 700;
const DEFAULT_RAPID_SCROLL_MINIMUM_EVENTS = 4;
const DEFAULT_RAPID_SCROLL_DELTA_THRESHOLD = 80;
const DEFAULT_CLICK_BURST_WINDOW_MS = 2000;
const DEFAULT_CLICK_BURST_MINIMUM_EVENTS = 8;
const RECIPIENT_BULK_FILL_WINDOW_MS = 5000;
const RECIPIENT_BULK_FILL_MINIMUM_FIELDS = 3;

export class LiveInteractionCollectingService {
  constructor(
    private readonly keystrokeInteractionCollectingService = new KeystrokeInteractionCollectingService(),
    private readonly phishingTextPatternMatchingService = new PhishingTextPatternMatchingService(),
    private readonly phishingUrlPatternMatchingService = new PhishingUrlPatternMatchingService(),
    private readonly speechTranscriptCollectingService = new SpeechTranscriptCollectingService(),
    private readonly pointerMovementCollectingService = new PointerMovementCollectingService(),
    private readonly fieldInputCollectingService = new FieldInputCollectingService(),
    private readonly pageVisibilityPatternCollectingService = new PageVisibilityPatternCollectingService(),
  ) {}

  install(config: LiveInteractionCollectingConfigEntity): UninstallingLiveInteractionCollection {
    const target = config.target ?? (globalThis as unknown as LiveInteractionTargetEntity);
    const documentTarget = target.document;
    const windowTarget = target.window;
    const uninstallers: UninstallingLiveInteractionCollection[] = [];
    let rapidScrollTimes: number[] = [];
    let clickTimes: number[] = [];
    const keystrokeState = this.keystrokeInteractionCollectingService.createState();
    const pointerState = this.pointerMovementCollectingService.createState();
    const inputStates = this.fieldInputCollectingService.createInputStates();
    const recipientBulkFillTrackingState = this.fieldInputCollectingService.createRecipientBulkFillTrackingState();
    const pageVisibilityState = this.pageVisibilityPatternCollectingService.createState();

    if (documentTarget !== undefined) {
      const handlePaste = (event: LiveInteractionDomEventEntity) => {
        if (this.fieldInputCollectingService.isAuthenticationTarget(event.target)) return;
        const atMs = this.now(config);
        const pastedText = event.clipboardData?.getData('text') ?? '';
        this.scanText(config, pastedText, 'clipboard');
        this.fieldInputCollectingService
          .collectPasteEvents(inputStates, recipientBulkFillTrackingState, event.target, pastedText, atMs)
          .forEach((collectedEvent) => {
            this.emitPageVisibilityAction(config, pageVisibilityState, target, collectedEvent.kind, event.target, atMs);
            this.emit(config, collectedEvent.kind, collectedEvent.metadata);
          });
      };
      const handleVisibilityChange = () => {
        this.emitPageVisibilityTransition(
          config,
          pageVisibilityState,
          target,
          documentTarget.visibilityState === 'hidden' ? 'page_hidden' : 'page_visible',
          'document_visibilitychange',
        );
      };
      const handlePointerMove = (event: LiveInteractionDomEventEntity) => {
        if (event.clientX === undefined || event.clientY === undefined) return;
        const atMs = this.now(config);
        const verdict = this.pointerMovementCollectingService.recordPointerMove(
          pointerState,
          event,
          atMs,
          {
            maxTouchPoints: target.navigator?.maxTouchPoints,
            pointerJumpThresholdPx: config.pointerJumpThresholdPx,
          },
        );
        this.emitPointerVerdict(config, verdict);
      };
      const handlePointerDown = (event: LiveInteractionDomEventEntity) => {
        this.pointerMovementCollectingService.recordPointerDown(pointerState, this.now(config));
      };
      const handlePointerUp = (event: LiveInteractionDomEventEntity) => {
        this.pointerMovementCollectingService.recordPointerUp(pointerState, this.now(config));
      };
      const handleKeyDown = (event: LiveInteractionDomEventEntity) => {
        if (this.fieldInputCollectingService.isAuthenticationTarget(event.target)) return;
        const atMs = this.now(config);
        this.recordPaymentFormActivity(pageVisibilityState, event.target, atMs);
        this.emitPageVisibilityAction(config, pageVisibilityState, target, 'keydown', event.target, atMs);
        this.fieldInputCollectingService.recordTypedKey(inputStates, event.target, event.key);
        this.keystrokeInteractionCollectingService.recordKeyDown(
          {
            ...config,
            isCorrectionExpectedTarget: (candidateTarget) => (
              this.fieldInputCollectingService.isCorrectionExpectedTarget(candidateTarget)
            ),
          },
          keystrokeState,
          event,
        );
      };
      const handleKeyUp = (event: LiveInteractionDomEventEntity) => {
        if (this.fieldInputCollectingService.isAuthenticationTarget(event.target)) return;
        this.keystrokeInteractionCollectingService.recordKeyUp(
          {
            ...config,
            isCorrectionExpectedTarget: (candidateTarget) => (
              this.fieldInputCollectingService.isCorrectionExpectedTarget(candidateTarget)
            ),
          },
          keystrokeState,
          event,
        );
      };
      const handleWheel = (event: LiveInteractionDomEventEntity) => {
        if (this.hasWarningTextInDocument(target)) {
          this.emit(config, 'warning_scrolled', { source: 'wheel' });
        }
        const delta = Math.max(Math.abs(event.deltaX ?? 0), Math.abs(event.deltaY ?? 0));
        if (delta < (config.rapidScrollDeltaThreshold ?? DEFAULT_RAPID_SCROLL_DELTA_THRESHOLD)) return;
        const atMs = this.now(config);
        const windowMs = config.rapidScrollWindowMs ?? DEFAULT_RAPID_SCROLL_WINDOW_MS;
        rapidScrollTimes = [...rapidScrollTimes.filter((scrollAtMs) => atMs - scrollAtMs <= windowMs), atMs];
        if (rapidScrollTimes.length >= (config.rapidScrollMinimumEvents ?? DEFAULT_RAPID_SCROLL_MINIMUM_EVENTS)) {
          this.emit(config, 'rapid_scroll_observed', {
            eventCount: rapidScrollTimes.length,
            windowMs,
          });
          rapidScrollTimes = [];
        }
      };
      const handleClick = (event: LiveInteractionDomEventEntity) => {
        const atMs = this.now(config);
        const isConfirmClick = CONFIRM_TEXT_PATTERN.test(this.fieldInputCollectingService.targetText(event.target));
        this.recordPaymentFormActivity(pageVisibilityState, event.target, atMs);
        this.emitPageVisibilityAction(
          config,
          pageVisibilityState,
          target,
          isConfirmClick ? 'confirm_click' : 'input',
          event.target,
          atMs,
        );
        this.emitPointerVerdict(
          config,
          this.pointerMovementCollectingService.recordClick(
            pointerState,
            event,
            atMs,
            {
              maxTouchPoints: target.navigator?.maxTouchPoints,
              pointerJumpThresholdPx: config.pointerJumpThresholdPx,
            },
          ),
        );
        const windowMs = config.clickBurstWindowMs ?? DEFAULT_CLICK_BURST_WINDOW_MS;
        clickTimes = [...clickTimes.filter((clickAtMs) => atMs - clickAtMs <= windowMs), atMs];
        if (clickTimes.length >= (config.clickBurstMinimumEvents ?? DEFAULT_CLICK_BURST_MINIMUM_EVENTS)) {
          this.emit(config, 'click_burst_observed', {
            eventCount: clickTimes.length,
            windowMs,
          });
          clickTimes = [];
        }
        if (isConfirmClick) {
          this.emit(config, 'warning_confirmed');
          this.emitPointerVerdict(config, this.pointerMovementCollectingService.recordFormSubmit(pointerState, atMs));
        }
      };
      const handleInput = (event: LiveInteractionDomEventEntity) => {
        if (this.fieldInputCollectingService.isAuthenticationTarget(event.target)) return;
        const atMs = this.now(config);
        this.recordPaymentFormActivity(pageVisibilityState, event.target, atMs);
        this.emitPageVisibilityAction(config, pageVisibilityState, target, 'input', event.target, atMs);
        this.pointerMovementCollectingService.recordFormInteraction(
          pointerState,
          atMs,
          this.hasWarningTextInDocument(target) || this.formRequiresReadingTarget(event.target),
        );
        this.fieldInputCollectingService
          .collectInputEvents(inputStates, recipientBulkFillTrackingState, event.target, atMs)
          .forEach((collectedEvent) => {
            this.emitPageVisibilityAction(config, pageVisibilityState, target, collectedEvent.kind, event.target, atMs);
            this.emit(config, collectedEvent.kind, collectedEvent.metadata);
          });
        this.scanText(config, this.fieldInputCollectingService.targetText(event.target), 'input');
      };

      documentTarget.addEventListener('paste', handlePaste);
      documentTarget.addEventListener('visibilitychange', handleVisibilityChange);
      documentTarget.addEventListener('pointermove', handlePointerMove);
      documentTarget.addEventListener('pointerdown', handlePointerDown);
      documentTarget.addEventListener('pointerup', handlePointerUp);
      documentTarget.addEventListener('keydown', handleKeyDown);
      documentTarget.addEventListener('keyup', handleKeyUp);
      documentTarget.addEventListener('wheel', handleWheel);
      documentTarget.addEventListener('click', handleClick);
      documentTarget.addEventListener('input', handleInput);
      documentTarget.addEventListener('change', handleInput);
      uninstallers.push(() => {
        documentTarget.removeEventListener('paste', handlePaste);
        documentTarget.removeEventListener('visibilitychange', handleVisibilityChange);
        documentTarget.removeEventListener('pointermove', handlePointerMove);
        documentTarget.removeEventListener('pointerdown', handlePointerDown);
        documentTarget.removeEventListener('pointerup', handlePointerUp);
        documentTarget.removeEventListener('keydown', handleKeyDown);
        documentTarget.removeEventListener('keyup', handleKeyUp);
        documentTarget.removeEventListener('wheel', handleWheel);
        documentTarget.removeEventListener('click', handleClick);
        documentTarget.removeEventListener('input', handleInput);
        documentTarget.removeEventListener('change', handleInput);
      });
    }

    if (windowTarget !== undefined) {
      const handleBlur = () => this.emitPageVisibilityTransition(
        config,
        pageVisibilityState,
        target,
        'page_hidden',
        'window_blur',
      );
      const handleFocus = () => this.emitPageVisibilityTransition(
        config,
        pageVisibilityState,
        target,
        'page_visible',
        'window_focus',
      );
      windowTarget.addEventListener('blur', handleBlur);
      windowTarget.addEventListener('focus', handleFocus);
      uninstallers.push(() => {
        windowTarget.removeEventListener('blur', handleBlur);
        windowTarget.removeEventListener('focus', handleFocus);
      });
    }

    if (target.MutationObserver !== undefined && documentTarget?.body !== undefined) {
      const observer = new target.MutationObserver(() => this.scanDocumentText(config, target));
      observer.observe(documentTarget.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      this.scanDocumentText(config, target);
      uninstallers.push(() => observer.disconnect());
    }

    if (config.collectSpeechTranscripts === true) {
      uninstallers.push(
        this.speechTranscriptCollectingService.install({
          onEvent: config.onEvent,
          target,
          language: config.speechLanguage,
          now: config.now,
        }),
      );
    }

    return () => {
      uninstallers.reverse().forEach((uninstall) => uninstall());
    };
  }

  private emitPageVisibilityTransition(
    config: LiveInteractionCollectingConfigEntity,
    state: PageVisibilityPatternCollectingState,
    target: LiveInteractionTargetEntity,
    kind: 'page_hidden' | 'page_visible',
    source: string,
  ): void {
    const atMs = this.now(config);
    const metadata = kind === 'page_hidden'
      ? this.pageVisibilityPatternCollectingService.collectExitMetadata(state, atMs, { target, source })
      : this.pageVisibilityPatternCollectingService.collectReturnMetadata(state, atMs, { target, source });
    this.emit(config, kind, metadata);
  }

  private emitPageVisibilityAction(
    config: LiveInteractionCollectingConfigEntity,
    state: PageVisibilityPatternCollectingState,
    target: LiveInteractionTargetEntity,
    kind: Parameters<LiveInteractionCollectingConfigEntity['onEvent']>[0]['kind'] | 'confirm_click' | 'input' | 'keydown',
    eventTarget: unknown,
    atMs: number,
  ): void {
    const actionKind = kind === 'recipient_pasted' ||
      kind === 'amount_pasted' ||
      kind === 'confirm_click' ||
      kind === 'keydown'
      ? kind
      : 'input';
    const metadata = this.pageVisibilityPatternCollectingService.collectActionMetadata(
      state,
      actionKind,
      atMs,
      {
        target,
        source: this.fieldInputCollectingService.targetText(eventTarget),
      },
    );
    if (metadata === null) return;
    this.emit(config, 'page_visibility_observed', metadata);
  }

  private recordPaymentFormActivity(
    state: PageVisibilityPatternCollectingState,
    target: unknown,
    atMs: number,
  ): void {
    if (!this.pageVisibilityPatternCollectingService.isPaymentFormTarget(
      this.fieldInputCollectingService.targetText(target),
    )) return;
    this.pageVisibilityPatternCollectingService.recordPaymentFormActivity(state, atMs);
  }

  private scanDocumentText(config: LiveInteractionCollectingConfigEntity, target: LiveInteractionTargetEntity): void {
    const text = [
      target.document?.body?.innerText ?? target.document?.body?.textContent ?? '',
      ...this.anchorTexts(target),
    ].join(' ');
    this.scanText(config, text, 'dom');
  }

  private hasWarningTextInDocument(target: LiveInteractionTargetEntity): boolean {
    const text = target.document?.body?.innerText ?? target.document?.body?.textContent ?? '';
    return this.phishingTextPatternMatchingService.hasWarningText(text);
  }

  private scanText(config: LiveInteractionCollectingConfigEntity, text: string, source: string): void {
    if (this.phishingTextPatternMatchingService.hasWarningText(text)) {
      this.emit(config, 'warning_shown', {
        source,
      });
    }
    if (this.phishingTextPatternMatchingService.hasPhishingText(text)) {
      this.emit(config, 'phishing_text_observed', {
        source,
        textLength: text.length,
      });
    }
    this.phishingUrlPatternMatchingService.extractUrls(text).forEach((url) => {
      const metadata = {
        source,
        url,
        contextText: text,
        textLength: text.length,
      };
      const reasonCodes = this.phishingUrlPatternMatchingService.match(url, metadata);
      if (reasonCodes.length === 0) return;
      this.emit(config, 'phishing_url_observed', {
        ...metadata,
        reason: reasonCodes[0],
        reasonCodes,
      });
    });
  }

  private anchorTexts(target: LiveInteractionTargetEntity): string[] {
    return this.anchorCandidates(target)
      .map((anchor) => {
        if (anchor === null || typeof anchor !== 'object') return '';
        const record = anchor as Record<string, unknown>;
        return [record.href, record.textContent]
          .filter((value): value is string => typeof value === 'string')
          .join(' ');
      })
      .filter((value) => value.trim() !== '');
  }

  private anchorCandidates(target: LiveInteractionTargetEntity): unknown[] {
    const documentAnchors = this.arrayLikeToArray(target.document?.querySelectorAll?.('a[href]'));
    const bodyAnchors = this.arrayLikeToArray(target.document?.body?.querySelectorAll?.('a[href]'));
    return [...documentAnchors, ...bodyAnchors];
  }

  private arrayLikeToArray(value: ArrayLike<unknown> | undefined): unknown[] {
    if (value === undefined) return [];
    return Array.from({ length: value.length }, (_item, index) => value[index]);
  }

  private targetDescriptor(target: unknown): string {
    return this.fieldInputCollectingService.targetDescriptor(target);
  }

  private looksLikeRecipient(text: string): boolean {
    const compact = text.replace(/\s+/g, '');
    return /^\+?\d{10,20}$/.test(compact) || /^[A-Z]{2}\d{12,32}$/i.test(compact);
  }

  private looksLikeAmount(text: string): boolean {
    const normalized = text
      .trim()
      .replace(/\s+/g, '')
      .replace(/[$€£₽]/g, '')
      .replace(/rub|ruble|руб/gi, '');
    return /^[+-]?\d{1,9}([.,]\d{1,2})?$/.test(normalized);
  }

  private isRecipientTarget(targetText: string, targetValue: string): boolean {
    return RECIPIENT_FIELD_PATTERN.test(targetText) ||
      RECIPIENT_BULK_FIELD_PATTERN.test(targetText) ||
      this.looksLikeRecipient(targetValue);
  }

  private targetValue(target: unknown): string {
    if (target === null || typeof target !== 'object') return '';
    const value = (target as Record<string, unknown>).value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
  }

  private isCorrectionExpectedTarget(target: unknown): boolean {
    const targetValue = this.targetValue(target);
    if (!/[A-Za-zА-Яа-я]/.test(targetValue)) return false;
    return this.isRecipientTarget(this.targetDescriptor(target), targetValue);
  }

  private emitPointerVerdict(
    config: LiveInteractionCollectingConfigEntity,
    verdict: PointerPatternVerdictEntity | null,
  ): void {
    if (verdict === null) return;
    this.emit(config, 'pointer_anomaly_observed', {
      reason: verdict.reasonCode,
      reasonCodes: verdict.reasonCodes,
      verdict: verdict.level,
      confidence: verdict.confidence,
      ...verdict.metadata,
    });
  }

  private formRequiresReadingTarget(target: unknown): boolean {
    return /(terms|warning|disclosure|agreement|notice|consent|read|review|услов|предупрежд|соглас)/i
      .test(this.fieldInputCollectingService.targetText(target));
  }

  private emit(
    config: LiveInteractionCollectingConfigEntity,
    kind: Parameters<LiveInteractionCollectingConfigEntity['onEvent']>[0]['kind'],
    metadata?: Record<string, unknown>,
  ): void {
    config.onEvent({
      kind,
      atMs: this.now(config),
      metadata,
    });
  }

  private now(config: LiveInteractionCollectingConfigEntity): number {
    return config.now?.() ?? Date.now();
  }
}
