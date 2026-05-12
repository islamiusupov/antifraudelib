import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { DBankObservedEventEntity } from '../../domain/dbank/entities/DBankObservedEventEntity';

const CURRENT_SESSION_NEW_RECIPIENT_BOOST = 35;
const LAYERING_RECIPIENT_COUNT = 3;
const LAYERING_WINDOW_MS = 60 * 60 * 1000;
const SMALL_TEST_PAYMENT_AMOUNT_LIMIT = 500;
const SMALL_TEST_PAYMENT_MONITOR_BOOST = 5;
const TEST_PAYMENT_TEXT_PATTERN = /(?:test[-_\s]?payment|probe|verification|micro[-_\s]?transfer|trial[-_\s]?payment)/i;

export class DBankLiveFactorExtractingService {
  extract(events: DBankObservedEventEntity[]): RiskSignalEntity[] {
    const signals: RiskSignalEntity[] = [];
    const hasNewRecipientLayeringPattern = this.hasNewRecipientLayeringPattern(events);
    const smallTestPaymentEvent = this.findSmallTestPaymentEvent(events);
    const hasSmallTestPaymentPattern = smallTestPaymentEvent !== undefined;

    if (this.hasEvent(events, 'recipient_pasted')) {
      signals.push({
        kind: 'copy_paste_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['copy_paste_recipient'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'amount_pasted')) {
      signals.push({
        kind: 'copy_paste_amount',
        detected: true,
        confidence: 1,
        reasonCodes: ['copy_paste_amount'],
        source: 'live',
      });
    }
    const recipientCreatedEvent = events.find((event) => event.kind === 'recipient_created');
    if (recipientCreatedEvent !== undefined) {
      signals.push(this.newRecipientSignal(recipientCreatedEvent, hasNewRecipientLayeringPattern, hasSmallTestPaymentPattern));
      if (this.isCurrentSessionUnusedRecipient(recipientCreatedEvent.metadata) && !hasSmallTestPaymentPattern) {
        signals.push(this.currentSessionNewRecipientBoostSignal(recipientCreatedEvent));
      }
      if (hasSmallTestPaymentPattern && !hasNewRecipientLayeringPattern) {
        signals.push(this.smallTestPaymentNewRecipientBoostSignal(smallTestPaymentEvent));
      }
    }
    if (hasNewRecipientLayeringPattern) {
      signals.push(
        {
          kind: 'recipient_velocity',
          detected: true,
          confidence: 1,
          reasonCodes: ['new_recipient_layering_pattern'],
          source: 'server',
        },
        {
          kind: 'velocity_anomaly',
          detected: true,
          confidence: 1,
          reasonCodes: ['layering_different_amounts'],
          source: 'server',
        },
      );
    }
    if (this.hasEvent(events, 'media_active')) {
      signals.push({
        kind: 'concurrent_media',
        detected: true,
        confidence: 1,
        reasonCodes: ['concurrent_media_active'],
        source: 'live',
      });
    }
    if (this.hasFastWarningConfirmation(events)) {
      signals.push({
        kind: 'warning_dwell',
        detected: true,
        confidence: 0.9,
        reasonCodes: ['warning_dwell_too_short'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'form_fill_order_observed')) {
      signals.push({
        kind: 'form_fill_order',
        detected: true,
        confidence: 1,
        reasonCodes: ['multi_field_recipient_bulk_fill'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'page_hidden') && this.hasEvent(events, 'page_visible')) {
      signals.push({
        kind: 'page_visibility',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['page_visibility_oscillation'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'visual_challenge_started')) {
      signals.push({
        kind: 'visual_challenge',
        detected: true,
        confidence: 1,
        reasonCodes: ['visual_challenge_started'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'keystroke_anomaly_observed')) {
      signals.push({
        kind: 'keystroke_dynamics',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['keystroke_dynamics_anomaly'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'pointer_anomaly_observed')) {
      signals.push({
        kind: 'pointer_pattern',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['pointer_pattern_anomaly'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'rapid_scroll_observed')) {
      signals.push({
        kind: 'pointer_pattern',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['rapid_scroll_pattern'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'native_tampering_observed')) {
      signals.push({
        kind: 'native_tampering',
        detected: true,
        confidence: 1,
        reasonCodes: ['native_tampering'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'dev_environment_observed')) {
      signals.push({
        kind: 'dev_environment',
        detected: true,
        confidence: 1,
        reasonCodes: ['dev_environment'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'bot_detected')) {
      signals.push({
        kind: 'bot_detection',
        detected: true,
        confidence: 1,
        reasonCodes: ['bot_detection'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'phishing_text_observed')) {
      signals.push({
        kind: 'phishing_text_dom',
        detected: true,
        confidence: 1,
        reasonCodes: ['phishing_text_dom'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'phishing_url_observed')) {
      signals.push({
        kind: 'phishing_url',
        detected: true,
        confidence: 1,
        reasonCodes: ['phishing_url_pattern'],
        source: 'live',
      });
    }
    if (this.hasEvent(events, 'token_injection_observed')) {
      signals.push({
        kind: 'recent_token_injection',
        detected: true,
        confidence: 1,
        reasonCodes: ['recent_token_injection'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'client_environment_observed')) {
      signals.push({
        kind: 'client_environment',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['client_environment'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'environment_conflict_observed')) {
      signals.push({
        kind: 'environment_conflicts',
        detected: true,
        confidence: 0.9,
        reasonCodes: ['environment_conflicts'],
        source: 'paper',
      });
    }
    if (this.hasEvent(events, 'device_fingerprint_observed')) {
      signals.push({
        kind: 'device_fingerprint',
        detected: true,
        confidence: 1,
        reasonCodes: ['device_fingerprint'],
        source: 'server',
      });
    }
    events
      .filter((event) => event.kind === 'server_factor_observed')
      .forEach((event) => {
        const factor = event.metadata?.factor;
        if (typeof factor !== 'string') return;
        signals.push({
          kind: factor,
          detected: true,
          confidence: 1,
          reasonCodes: [`${factor}_server_helper`],
          source: 'server',
        });
      });

    return signals;
  }

  private hasEvent(events: DBankObservedEventEntity[], kind: DBankObservedEventEntity['kind']): boolean {
    return events.some((event) => event.kind === kind);
  }

  private newRecipientSignal(
    event: DBankObservedEventEntity,
    hasLayeringPattern = false,
    hasSmallTestPaymentPattern = false,
  ): RiskSignalEntity {
    if (this.isServerVerifiedNewRecipient(event.metadata)) {
      return {
        kind: 'new_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_in_flow'],
        source: 'server',
        metadata: event.metadata,
      };
    }
    if (hasSmallTestPaymentPattern) {
      return {
        kind: 'new_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_test_payment_pattern'],
        source: 'server',
        metadata: event.metadata,
      };
    }
    if (hasLayeringPattern) {
      return {
        kind: 'new_recipient',
        detected: true,
        confidence: 1,
        reasonCodes: ['new_recipient_layering_pattern'],
        source: 'server',
        metadata: event.metadata,
      };
    }

    return {
      kind: 'new_recipient',
      detected: true,
      confidence: 0.4,
      reasonCodes: ['new_recipient_ui_only'],
      source: 'server',
      metadata: {
        rawEventKind: event.kind,
      },
    };
  }

  private smallTestPaymentNewRecipientBoostSignal(event: DBankObservedEventEntity): RiskSignalEntity {
    return {
      kind: 'composite_risk_boost',
      detected: true,
      contribution: SMALL_TEST_PAYMENT_MONITOR_BOOST,
      maxContribution: SMALL_TEST_PAYMENT_MONITOR_BOOST,
      reasonCodes: ['new_recipient_small_test_payment_pattern'],
      source: 'server',
      metadata: event.metadata,
    };
  }

  private currentSessionNewRecipientBoostSignal(event: DBankObservedEventEntity): RiskSignalEntity {
    return {
      kind: 'composite_risk_boost',
      detected: true,
      contribution: CURRENT_SESSION_NEW_RECIPIENT_BOOST,
      maxContribution: CURRENT_SESSION_NEW_RECIPIENT_BOOST,
      reasonCodes: ['recipient_added_current_session_no_previous_use'],
      source: 'server',
      metadata: event.metadata,
    };
  }

  private isServerVerifiedNewRecipient(metadata: DBankObservedEventEntity['metadata']): boolean {
    return metadata?.serverVerified === true;
  }

  private isCurrentSessionUnusedRecipient(metadata: DBankObservedEventEntity['metadata']): boolean {
    return (
      this.isServerVerifiedNewRecipient(metadata) &&
      this.isCurrentSessionRecipient(metadata) &&
      this.hasNoPreviousRecipientUse(metadata)
    );
  }

  private isCurrentSessionRecipient(metadata: DBankObservedEventEntity['metadata']): boolean {
    return (
      metadata?.createdInCurrentSession === true ||
      metadata?.addedInCurrentSession === true ||
      metadata?.currentSessionRecipient === true
    );
  }

  private hasNoPreviousRecipientUse(metadata: DBankObservedEventEntity['metadata']): boolean {
    const txCountToRecipient = metadata?.txCountToRecipient;
    if (typeof txCountToRecipient === 'number') return txCountToRecipient <= 0;
    const previousUseCount = metadata?.previousUseCount;
    if (typeof previousUseCount === 'number') return previousUseCount <= 0;
    return metadata?.hasPreviousUse === false;
  }

  private findSmallTestPaymentEvent(events: DBankObservedEventEntity[]): DBankObservedEventEntity | undefined {
    const amountEvent = events.find((event) => this.hasSmallPaymentAmount(event.metadata));
    if (amountEvent === undefined) return undefined;
    return events.find((event) => this.hasTestPaymentPattern(event.metadata));
  }

  private hasSmallPaymentAmount(metadata: DBankObservedEventEntity['metadata']): boolean {
    const amount = this.extractNumberMetadata(metadata, ['amount', 'transferAmount', 'transactionAmount']);
    return amount !== null && amount > 0 && amount < SMALL_TEST_PAYMENT_AMOUNT_LIMIT;
  }

  private hasTestPaymentPattern(metadata: DBankObservedEventEntity['metadata']): boolean {
    if (metadata?.testPaymentPattern === true || metadata?.isTestPayment === true) return true;
    return this.extractTextMetadata(metadata, ['paymentPattern', 'comment', 'purpose', 'description', 'message', 'remittanceInfo'])
      .some((value) => TEST_PAYMENT_TEXT_PATTERN.test(value));
  }

  private hasNewRecipientLayeringPattern(events: DBankObservedEventEntity[]): boolean {
    const recipientEvents = events
      .filter((event) => event.kind === 'recipient_created')
      .sort((left, right) => left.atMs - right.atMs);

    return recipientEvents.some((event, index) => {
      const windowEvents = recipientEvents
        .slice(index)
        .filter((candidate) => candidate.atMs - event.atMs <= LAYERING_WINDOW_MS);
      return (
        windowEvents.length >= LAYERING_RECIPIENT_COUNT &&
        this.hasDistinctRecipients(windowEvents) &&
        this.hasDistinctAmounts(windowEvents)
      );
    });
  }

  private hasDistinctRecipients(events: DBankObservedEventEntity[]): boolean {
    const recipientKeys = events
      .map((event) => this.extractStringMetadata(event.metadata, ['recipientId', 'beneficiaryId', 'accountNumber', 'iban']))
      .filter((value): value is string => value !== null);
    if (recipientKeys.length === 0) return true;
    return new Set(recipientKeys).size >= LAYERING_RECIPIENT_COUNT;
  }

  private hasDistinctAmounts(events: DBankObservedEventEntity[]): boolean {
    const amounts = events
      .map((event) => this.extractNumberMetadata(event.metadata, ['amount', 'transferAmount', 'transactionAmount']))
      .filter((value): value is number => value !== null);
    return amounts.length >= LAYERING_RECIPIENT_COUNT && new Set(amounts.map((amount) => amount.toFixed(2))).size >= LAYERING_RECIPIENT_COUNT;
  }

  private extractStringMetadata(
    metadata: DBankObservedEventEntity['metadata'],
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = metadata?.[key];
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
    return null;
  }

  private extractTextMetadata(
    metadata: DBankObservedEventEntity['metadata'],
    keys: string[],
  ): string[] {
    return keys
      .map((key) => metadata?.[key])
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  }

  private extractNumberMetadata(
    metadata: DBankObservedEventEntity['metadata'],
    keys: string[],
  ): number | null {
    for (const key of keys) {
      const value = metadata?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const normalizedValue = Number(value.replace(',', '.'));
        if (Number.isFinite(normalizedValue)) return normalizedValue;
      }
    }
    return null;
  }

  private hasFastWarningConfirmation(events: DBankObservedEventEntity[]): boolean {
    const warningShown = events.find((event) => event.kind === 'warning_shown');
    const warningConfirmed = events.find((event) => event.kind === 'warning_confirmed');
    if (warningShown === undefined || warningConfirmed === undefined) return false;
    return warningConfirmed.atMs - warningShown.atMs < 1000;
  }
}
