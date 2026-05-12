import type { LiveInteractionCollectingConfigEntity } from '../../domain/live/entities/LiveInteractionCollectingConfigEntity';
import type { LiveInteractionDomEventEntity, LiveInteractionTargetEntity } from '../../domain/live/entities/LiveInteractionTargetEntity';
import { PhishingTextPatternMatchingService } from './PhishingTextPatternMatchingService';

type UninstallingLiveInteractionCollection = () => void;

const RECIPIENT_FIELD_PATTERN = /(recipient|beneficiary|iban|account|card|phone|получател|счет|счёт|карта|телефон)/i;
const CONFIRM_TEXT_PATTERN = /(confirm|continue|submit|pay|transfer|подтверд|продолж|перевести|отправ)/i;

export class LiveInteractionCollectingService {
  constructor(private readonly phishingTextPatternMatchingService = new PhishingTextPatternMatchingService()) {}

  install(config: LiveInteractionCollectingConfigEntity): UninstallingLiveInteractionCollection {
    const target = config.target ?? (globalThis as unknown as LiveInteractionTargetEntity);
    const documentTarget = target.document;
    const windowTarget = target.window;
    const uninstallers: UninstallingLiveInteractionCollection[] = [];
    let previousPointer: { x: number; y: number; atMs: number } | undefined;
    let previousKeyAtMs: number | undefined;
    let fastKeyCount = 0;

    if (documentTarget !== undefined) {
      const handlePaste = (event: LiveInteractionDomEventEntity) => {
        const targetText = this.targetText(event.target);
        const pastedText = event.clipboardData?.getData('text') ?? '';
        if (!RECIPIENT_FIELD_PATTERN.test(targetText) && !this.looksLikeRecipient(pastedText)) return;
        this.emit(config, 'recipient_pasted', {
          targetText,
          pastedLength: pastedText.length,
        });
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
        if (previousKeyAtMs !== undefined && atMs - previousKeyAtMs <= (config.fastKeyIntervalMs ?? 8)) {
          fastKeyCount += 1;
        } else {
          fastKeyCount = 0;
        }
        previousKeyAtMs = atMs;
        if (fastKeyCount >= 3) {
          this.emit(config, 'keystroke_anomaly_observed', { reason: 'machine_fast_key_intervals' });
        }
      };
      const handleClick = (event: LiveInteractionDomEventEntity) => {
        if (CONFIRM_TEXT_PATTERN.test(this.targetText(event.target))) {
          this.emit(config, 'warning_confirmed');
        }
      };

      documentTarget.addEventListener('paste', handlePaste);
      documentTarget.addEventListener('visibilitychange', handleVisibilityChange);
      documentTarget.addEventListener('pointermove', handlePointerMove);
      documentTarget.addEventListener('keydown', handleKeyDown);
      documentTarget.addEventListener('click', handleClick);
      uninstallers.push(() => {
        documentTarget.removeEventListener('paste', handlePaste);
        documentTarget.removeEventListener('visibilitychange', handleVisibilityChange);
        documentTarget.removeEventListener('pointermove', handlePointerMove);
        documentTarget.removeEventListener('keydown', handleKeyDown);
        documentTarget.removeEventListener('click', handleClick);
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

    return () => {
      uninstallers.reverse().forEach((uninstall) => uninstall());
    };
  }

  private scanDocumentText(config: LiveInteractionCollectingConfigEntity, target: LiveInteractionTargetEntity): void {
    const text = target.document?.body?.innerText ?? target.document?.body?.textContent ?? '';
    if (this.phishingTextPatternMatchingService.hasWarningText(text)) {
      this.emit(config, 'warning_shown');
    }
    if (this.phishingTextPatternMatchingService.hasPhishingText(text)) {
      this.emit(config, 'phishing_text_observed', {
        textLength: text.length,
      });
    }
  }

  private targetText(target: unknown): string {
    if (target === null || typeof target !== 'object') return '';
    const record = target as Record<string, unknown>;
    return [
      record.name,
      record.id,
      record.placeholder,
      record.ariaLabel,
      record.textContent,
      record.value,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  }

  private looksLikeRecipient(text: string): boolean {
    const compact = text.replace(/\s+/g, '');
    return /^\+?\d{10,20}$/.test(compact) || /^[A-Z]{2}\d{12,32}$/i.test(compact);
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
