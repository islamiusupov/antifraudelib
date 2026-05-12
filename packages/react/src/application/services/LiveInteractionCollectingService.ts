import type { LiveInteractionCollectingConfigEntity } from '../../domain/live/entities/LiveInteractionCollectingConfigEntity';
import type { LiveInteractionDomEventEntity, LiveInteractionTargetEntity } from '../../domain/live/entities/LiveInteractionTargetEntity';
import { PhishingTextPatternMatchingService } from './PhishingTextPatternMatchingService';
import { SpeechTranscriptCollectingService } from './SpeechTranscriptCollectingService';

type UninstallingLiveInteractionCollection = () => void;
type FieldInputTrackingState = {
  keyCount: number;
  previousValue: string;
  lastRecipientPasteValue?: string;
  lastAmountPasteValue?: string;
};

const AMOUNT_FIELD_PATTERN = /(amount|sum|total|price|payment|rub|ruble|₽|сумм|руб)/i;
const RECIPIENT_FIELD_PATTERN = /(recipient|beneficiary|iban|account|card|phone|получател|счет|счёт|карта|телефон)/i;
const CONFIRM_TEXT_PATTERN = /(confirm|continue|submit|pay|transfer|подтверд|продолж|перевести|отправ)/i;
const DEFAULT_FAST_KEY_INTERVAL_MS = 60;
const DEFAULT_RAPID_SCROLL_WINDOW_MS = 700;
const DEFAULT_RAPID_SCROLL_MINIMUM_EVENTS = 4;
const DEFAULT_RAPID_SCROLL_DELTA_THRESHOLD = 80;

export class LiveInteractionCollectingService {
  constructor(
    private readonly phishingTextPatternMatchingService = new PhishingTextPatternMatchingService(),
    private readonly speechTranscriptCollectingService = new SpeechTranscriptCollectingService(),
  ) {}

  install(config: LiveInteractionCollectingConfigEntity): UninstallingLiveInteractionCollection {
    const target = config.target ?? (globalThis as unknown as LiveInteractionTargetEntity);
    const documentTarget = target.document;
    const windowTarget = target.window;
    const uninstallers: UninstallingLiveInteractionCollection[] = [];
    let previousPointer: { x: number; y: number; atMs: number } | undefined;
    let previousKeyAtMs: number | undefined;
    let fastKeyCount = 0;
    let rapidScrollTimes: number[] = [];
    const inputStates = new WeakMap<object, FieldInputTrackingState>();

    if (documentTarget !== undefined) {
      const handlePaste = (event: LiveInteractionDomEventEntity) => {
        const targetText = this.targetText(event.target);
        const targetDescriptor = this.targetDescriptor(event.target);
        const pastedText = event.clipboardData?.getData('text') ?? '';
        if (RECIPIENT_FIELD_PATTERN.test(targetText) || this.looksLikeRecipient(pastedText)) {
          this.recordRecipientPaste(inputStates, event.target, pastedText);
          this.emit(config, 'recipient_pasted', {
            targetText: targetDescriptor,
            pastedLength: pastedText.length,
          });
          return;
        }
        if (this.isAmountPaste(event.target, targetText, pastedText)) {
          this.recordAmountPaste(inputStates, event.target, pastedText);
          this.emit(config, 'amount_pasted', {
            targetText: targetDescriptor,
            pastedLength: pastedText.length,
          });
        }
      };
      const handleVisibilityChange = () => {
        this.emit(config, documentTarget.visibilityState === 'hidden' ? 'page_hidden' : 'page_visible');
      };
      const handlePointerMove = (event: LiveInteractionDomEventEntity) => {
        if (event.clientX === undefined || event.clientY === undefined) return;
        const atMs = this.now(config);
        const threshold = config.pointerJumpThresholdPx ?? 800;
        if (previousPointer !== undefined) {
          const distance = Math.hypot(event.clientX - previousPointer.x, event.clientY - previousPointer.y);
          const elapsedMs = atMs - previousPointer.atMs;
          if (distance >= threshold && elapsedMs <= 100) {
            this.emit(config, 'pointer_anomaly_observed', {
              distance,
              elapsedMs,
            });
          }
        }
        previousPointer = { x: event.clientX, y: event.clientY, atMs };
      };
      const handleKeyDown = (event: LiveInteractionDomEventEntity) => {
        const atMs = this.now(config);
        if (event.isTrusted === false) {
          this.emit(config, 'keystroke_anomaly_observed', { reason: 'untrusted_key_event' });
          return;
        }
        this.recordTypedKey(inputStates, event.target, event.key);
        if (previousKeyAtMs !== undefined && atMs - previousKeyAtMs <= (config.fastKeyIntervalMs ?? DEFAULT_FAST_KEY_INTERVAL_MS)) {
          fastKeyCount += 1;
        } else {
          fastKeyCount = 0;
        }
        previousKeyAtMs = atMs;
        if (fastKeyCount >= 3) {
          this.emit(config, 'keystroke_anomaly_observed', { reason: 'fast_key_burst' });
        }
      };
      const handleWheel = (event: LiveInteractionDomEventEntity) => {
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
        if (CONFIRM_TEXT_PATTERN.test(this.targetText(event.target))) {
          this.emit(config, 'warning_confirmed');
        }
      };
      const handleInput = (event: LiveInteractionDomEventEntity) => {
        this.detectRecipientFilledWithoutTyping(config, inputStates, event.target);
        this.detectAmountFilledWithoutTyping(config, inputStates, event.target);
        this.scanText(config, this.targetText(event.target), 'input');
      };

      documentTarget.addEventListener('paste', handlePaste);
      documentTarget.addEventListener('visibilitychange', handleVisibilityChange);
      documentTarget.addEventListener('pointermove', handlePointerMove);
      documentTarget.addEventListener('keydown', handleKeyDown);
      documentTarget.addEventListener('wheel', handleWheel);
      documentTarget.addEventListener('click', handleClick);
      documentTarget.addEventListener('input', handleInput);
      documentTarget.addEventListener('change', handleInput);
      uninstallers.push(() => {
        documentTarget.removeEventListener('paste', handlePaste);
        documentTarget.removeEventListener('visibilitychange', handleVisibilityChange);
        documentTarget.removeEventListener('pointermove', handlePointerMove);
        documentTarget.removeEventListener('keydown', handleKeyDown);
        documentTarget.removeEventListener('wheel', handleWheel);
        documentTarget.removeEventListener('click', handleClick);
        documentTarget.removeEventListener('input', handleInput);
        documentTarget.removeEventListener('change', handleInput);
      });
    }

    if (windowTarget !== undefined) {
      const handleBlur = () => this.emit(config, 'page_hidden', { source: 'window_blur' });
      const handleFocus = () => this.emit(config, 'page_visible', { source: 'window_focus' });
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

  private scanDocumentText(config: LiveInteractionCollectingConfigEntity, target: LiveInteractionTargetEntity): void {
    const text = target.document?.body?.innerText ?? target.document?.body?.textContent ?? '';
    this.scanText(config, text, 'dom');
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
  }

  private targetText(target: unknown): string {
    if (target === null || typeof target !== 'object') return '';
    const record = target as Record<string, unknown>;
    return [
      this.targetDescriptor(target),
      record.value,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  }

  private targetDescriptor(target: unknown): string {
    if (target === null || typeof target !== 'object') return '';
    const record = target as Record<string, unknown>;
    return [
      record.name,
      record.type,
      record.id,
      record.placeholder,
      record.ariaLabel,
      record.textContent,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  }

  private looksLikeRecipient(text: string): boolean {
    const compact = text.replace(/\s+/g, '');
    return /^\+?\d{10,20}$/.test(compact) || /^[A-Z]{2}\d{12,32}$/i.test(compact);
  }

  private isAmountPaste(target: unknown, targetText: string, pastedText: string): boolean {
    if (!this.looksLikeAmount(pastedText)) return false;
    if (AMOUNT_FIELD_PATTERN.test(targetText)) return true;
    if (target === null || typeof target !== 'object') return false;
    const type = (target as Record<string, unknown>).type;
    return type === 'number' && !RECIPIENT_FIELD_PATTERN.test(targetText);
  }

  private looksLikeAmount(text: string): boolean {
    const normalized = text
      .trim()
      .replace(/\s+/g, '')
      .replace(/[$€£₽]/g, '')
      .replace(/rub|ruble|руб/gi, '');
    return /^[+-]?\d{1,9}([.,]\d{1,2})?$/.test(normalized);
  }

  private recordRecipientPaste(
    inputStates: WeakMap<object, FieldInputTrackingState>,
    target: unknown,
    pastedText: string,
  ): void {
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return;
    state.lastRecipientPasteValue = pastedText;
  }

  private recordAmountPaste(
    inputStates: WeakMap<object, FieldInputTrackingState>,
    target: unknown,
    pastedText: string,
  ): void {
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return;
    state.lastAmountPasteValue = pastedText;
  }

  private recordTypedKey(
    inputStates: WeakMap<object, FieldInputTrackingState>,
    target: unknown,
    key: string | undefined,
  ): void {
    if (!this.isTextInputKey(key)) return;
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return;
    state.keyCount += 1;
  }

  private detectRecipientFilledWithoutTyping(
    config: LiveInteractionCollectingConfigEntity,
    inputStates: WeakMap<object, FieldInputTrackingState>,
    target: unknown,
  ): void {
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return;

    const targetText = this.targetText(target);
    const targetValue = this.targetValue(target);
    if (!this.isRecipientTarget(targetText, targetValue)) return;

    const previousValue = state.previousValue;
    state.previousValue = targetValue;
    if (targetValue === '' || targetValue === state.lastRecipientPasteValue) return;

    const grewBy = targetValue.length - previousValue.length;
    const wasFilledWithoutTyping = state.keyCount === 0 && targetValue.length >= 3;
    const wasBulkFilled = grewBy >= 6;
    if (!wasFilledWithoutTyping && !wasBulkFilled) return;

    this.emit(config, 'recipient_pasted', {
      targetText: this.targetDescriptor(target),
      pastedLength: targetValue.length,
      reason: wasFilledWithoutTyping ? 'filled_without_typing' : 'bulk_input_jump',
    });
    state.lastRecipientPasteValue = targetValue;
  }

  private detectAmountFilledWithoutTyping(
    config: LiveInteractionCollectingConfigEntity,
    inputStates: WeakMap<object, FieldInputTrackingState>,
    target: unknown,
  ): void {
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return;

    const targetValue = this.targetValue(target);
    const targetDescriptor = this.targetDescriptor(target);
    if (!this.isAmountTarget(target, targetDescriptor, targetValue)) return;

    const previousValue = state.previousValue;
    state.previousValue = targetValue;
    if (targetValue === '' || targetValue === state.lastAmountPasteValue) return;

    const grewBy = targetValue.length - previousValue.length;
    const wasFilledWithoutTyping = state.keyCount === 0 && targetValue.length >= 2;
    const wasBulkFilled = grewBy >= 4;
    if (!wasFilledWithoutTyping && !wasBulkFilled) return;

    this.emit(config, 'amount_pasted', {
      targetText: targetDescriptor,
      pastedLength: targetValue.length,
      reason: wasFilledWithoutTyping ? 'filled_without_typing' : 'bulk_input_jump',
    });
    state.lastAmountPasteValue = targetValue;
  }

  private isRecipientTarget(targetText: string, targetValue: string): boolean {
    return RECIPIENT_FIELD_PATTERN.test(targetText) || this.looksLikeRecipient(targetValue);
  }

  private isAmountTarget(target: unknown, targetDescriptor: string, targetValue: string): boolean {
    if (!this.looksLikeAmount(targetValue)) return false;
    if (AMOUNT_FIELD_PATTERN.test(targetDescriptor)) return true;
    if (target === null || typeof target !== 'object') return false;
    const type = (target as Record<string, unknown>).type;
    return type === 'number' && !RECIPIENT_FIELD_PATTERN.test(targetDescriptor);
  }

  private targetValue(target: unknown): string {
    if (target === null || typeof target !== 'object') return '';
    const value = (target as Record<string, unknown>).value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
  }

  private fieldState(
    inputStates: WeakMap<object, FieldInputTrackingState>,
    target: unknown,
  ): FieldInputTrackingState | undefined {
    if (target === null || typeof target !== 'object') return undefined;
    const existingState = inputStates.get(target);
    if (existingState !== undefined) return existingState;
    const nextState = {
      keyCount: 0,
      previousValue: this.targetValue(target),
    };
    inputStates.set(target, nextState);
    return nextState;
  }

  private isTextInputKey(key: string | undefined): boolean {
    return key === undefined || key.length === 1 || key === 'Backspace' || key === 'Delete';
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
