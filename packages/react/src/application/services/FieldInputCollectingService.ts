import type { LiveInteractionEventEntity } from '../../domain/live/entities/LiveInteractionEventEntity';

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

export type FieldInputCollectedEvent = {
  kind: 'recipient_pasted' | 'amount_pasted' | 'form_fill_order_observed';
  metadata?: LiveInteractionEventEntity['metadata'];
};
export type FieldInputStateMap = WeakMap<object, FieldInputTrackingState>;

const AUTH_FIELD_PATTERN = /(auth|credential|login|log-in|signin|sign-in|password|passwd|username|user-name|email|e-mail|otp|one[-_\s]?time[-_\s]?code)/i;
const AUTH_AUTOCOMPLETE_PATTERN = /^(username|current-password|new-password|one-time-code)$/i;
const AMOUNT_FIELD_PATTERN = /(amount|sum|total|price|payment|rub|ruble|в‚Ѕ|СЃСѓРјРј|СЂСѓР±)/i;
const RECIPIENT_BULK_FIELD_PATTERN = /(recipient|beneficiary|receiver|iban|bic|bik|swift|account|card|phone|bank|holder|inn|РїРѕР»СѓС‡Р°С‚РµР»|СЃС‡РµС‚|СЃС‡С‘С‚|РєР°СЂС‚Р°|С‚РµР»РµС„РѕРЅ|Р±РёРє|Р±Р°РЅРє)/i;
const RECIPIENT_FIELD_PATTERN = /(recipient|beneficiary|iban|account|card|phone|РїРѕР»СѓС‡Р°С‚РµР»|СЃС‡РµС‚|СЃС‡С‘С‚|РєР°СЂС‚Р°|С‚РµР»РµС„РѕРЅ)/i;
const RECIPIENT_BULK_FILL_WINDOW_MS = 5000;
const RECIPIENT_BULK_FILL_MINIMUM_FIELDS = 3;

export class FieldInputCollectingService {
  createInputStates(): FieldInputStateMap {
    return new WeakMap<object, FieldInputTrackingState>();
  }

  createRecipientBulkFillTrackingState(): RecipientBulkFillTrackingState {
    return { records: [] };
  }

  collectPasteEvents(
    inputStates: FieldInputStateMap,
    recipientBulkFillTrackingState: RecipientBulkFillTrackingState,
    target: unknown,
    pastedText: string,
    atMs: number,
  ): FieldInputCollectedEvent[] {
    const targetDescriptor = this.targetDescriptor(target);
    if (this.isRecipientTarget(targetDescriptor, pastedText)) {
      const inputState = this.recordRecipientPaste(inputStates, target, pastedText);
      return [
        {
          kind: 'recipient_pasted',
          metadata: {
            targetText: targetDescriptor,
            pastedLength: pastedText.length,
            ...this.manualInputMetadata(inputState),
          },
        },
        ...this.recordRecipientBulkFill(recipientBulkFillTrackingState, target, atMs),
      ];
    }
    if (this.isAmountPaste(target, targetDescriptor, pastedText)) {
      const inputState = this.recordAmountPaste(inputStates, target, pastedText);
      return [
        {
          kind: 'amount_pasted',
          metadata: {
            targetText: targetDescriptor,
            pastedLength: pastedText.length,
            ...this.manualInputMetadata(inputState),
          },
        },
      ];
    }
    return [];
  }

  collectInputEvents(
    inputStates: FieldInputStateMap,
    recipientBulkFillTrackingState: RecipientBulkFillTrackingState,
    target: unknown,
    atMs: number,
  ): FieldInputCollectedEvent[] {
    return [
      ...this.detectRecipientFilledWithoutTyping(inputStates, recipientBulkFillTrackingState, target, atMs),
      ...this.detectAmountFilledWithoutTyping(inputStates, target),
    ];
  }

  recordTypedKey(inputStates: FieldInputStateMap, target: unknown, key: string | undefined): void {
    if (!this.isTextInputKey(key)) return;
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return;
    state.keyCount += 1;
  }

  isAuthenticationTarget(target: unknown): boolean {
    const descriptor = this.targetDescriptor(target);
    if (AUTH_FIELD_PATTERN.test(descriptor)) return true;
    if (target === null || typeof target !== 'object') return false;
    const record = target as Record<string, unknown>;
    if (record.type === 'password') return true;
    if (typeof record.autocomplete === 'string' && AUTH_AUTOCOMPLETE_PATTERN.test(record.autocomplete)) return true;
    return typeof record.name === 'string' && AUTH_FIELD_PATTERN.test(record.name);
  }

  isCorrectionExpectedTarget(target: unknown): boolean {
    const targetValue = this.targetValue(target);
    if (!/[A-Za-z\u0400-\u04ff]/.test(targetValue)) return false;
    return this.isRecipientTarget(this.targetDescriptor(target), targetValue);
  }

  targetText(target: unknown): string {
    if (target === null || typeof target !== 'object') return '';
    const record = target as Record<string, unknown>;
    return [
      this.targetDescriptor(target),
      record.value,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  }

  targetDescriptor(target: unknown): string {
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

  private detectRecipientFilledWithoutTyping(
    inputStates: FieldInputStateMap,
    recipientBulkFillTrackingState: RecipientBulkFillTrackingState,
    target: unknown,
    atMs: number,
  ): FieldInputCollectedEvent[] {
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return [];

    const targetText = this.targetDescriptor(target);
    const targetValue = this.targetValue(target);
    if (!this.isRecipientTarget(targetText, targetValue)) return [];

    const previousValue = state.previousValue;
    state.previousValue = targetValue;
    if (targetValue === '' || targetValue === state.lastRecipientPasteValue) return [];

    const grewBy = targetValue.length - previousValue.length;
    const wasFilledWithoutTyping = state.keyCount === 0 && targetValue.length >= 3;
    const wasBulkFilled = grewBy >= 6;
    if (!wasFilledWithoutTyping && !wasBulkFilled) return [];

    state.lastRecipientPasteValue = targetValue;
    return [
      {
        kind: 'recipient_pasted',
        metadata: {
          targetText: this.targetDescriptor(target),
          pastedLength: targetValue.length,
          reason: wasFilledWithoutTyping ? 'filled_without_typing' : 'bulk_input_jump',
          ...this.manualInputMetadata(state),
        },
      },
      ...this.recordRecipientBulkFill(recipientBulkFillTrackingState, target, atMs),
    ];
  }

  private detectAmountFilledWithoutTyping(
    inputStates: FieldInputStateMap,
    target: unknown,
  ): FieldInputCollectedEvent[] {
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return [];

    const targetValue = this.targetValue(target);
    const targetDescriptor = this.targetDescriptor(target);
    if (!this.isAmountTarget(target, targetDescriptor, targetValue)) return [];

    const previousValue = state.previousValue;
    state.previousValue = targetValue;
    if (targetValue === '' || targetValue === state.lastAmountPasteValue) return [];

    const grewBy = targetValue.length - previousValue.length;
    const wasFilledWithoutTyping = state.keyCount === 0 && targetValue.length >= 2;
    const wasBulkFilled = grewBy >= 4;
    if (!wasFilledWithoutTyping && !wasBulkFilled) return [];

    state.lastAmountPasteValue = targetValue;
    return [
      {
        kind: 'amount_pasted',
        metadata: {
          targetText: targetDescriptor,
          pastedLength: targetValue.length,
          reason: wasFilledWithoutTyping ? 'filled_without_typing' : 'bulk_input_jump',
          ...this.manualInputMetadata(state),
        },
      },
    ];
  }

  private recordRecipientPaste(inputStates: FieldInputStateMap, target: unknown, pastedText: string): FieldInputTrackingState | undefined {
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return undefined;
    state.lastRecipientPasteValue = pastedText;
    return state;
  }

  private recordAmountPaste(inputStates: FieldInputStateMap, target: unknown, pastedText: string): FieldInputTrackingState | undefined {
    const state = this.fieldState(inputStates, target);
    if (state === undefined) return undefined;
    state.lastAmountPasteValue = pastedText;
    return state;
  }

  private recordRecipientBulkFill(
    recipientBulkFillTrackingState: RecipientBulkFillTrackingState,
    target: unknown,
    atMs: number,
  ): FieldInputCollectedEvent[] {
    const fieldKey = this.targetDescriptor(target);
    if (fieldKey === '') return [];

    const records = recipientBulkFillTrackingState.records
      .filter((record) => atMs - record.atMs <= RECIPIENT_BULK_FILL_WINDOW_MS)
      .filter((record) => record.fieldKey !== fieldKey);

    records.push({ fieldKey, atMs });
    recipientBulkFillTrackingState.records = records;

    if (records.length < RECIPIENT_BULK_FILL_MINIMUM_FIELDS) return [];
    recipientBulkFillTrackingState.records = [];
    return [
      {
        kind: 'form_fill_order_observed',
        metadata: {
          reason: 'multi_field_recipient_bulk_fill',
          fieldCount: records.length,
          windowMs: RECIPIENT_BULK_FILL_WINDOW_MS,
        },
      },
    ];
  }

  private isRecipientTarget(targetText: string, targetValue: string): boolean {
    return RECIPIENT_FIELD_PATTERN.test(targetText) ||
      RECIPIENT_BULK_FIELD_PATTERN.test(targetText) ||
      this.looksLikeRecipient(targetValue);
  }

  private isAmountPaste(target: unknown, targetText: string, pastedText: string): boolean {
    if (!this.looksLikeAmount(pastedText)) return false;
    if (AMOUNT_FIELD_PATTERN.test(targetText)) return true;
    if (target === null || typeof target !== 'object') return false;
    const type = (target as Record<string, unknown>).type;
    return type === 'number' && !RECIPIENT_FIELD_PATTERN.test(targetText);
  }

  private isAmountTarget(target: unknown, targetDescriptor: string, targetValue: string): boolean {
    if (!this.looksLikeAmount(targetValue)) return false;
    if (AMOUNT_FIELD_PATTERN.test(targetDescriptor)) return true;
    if (target === null || typeof target !== 'object') return false;
    const type = (target as Record<string, unknown>).type;
    return type === 'number' && !RECIPIENT_FIELD_PATTERN.test(targetDescriptor);
  }

  private looksLikeRecipient(text: string): boolean {
    const compact = text.replace(/\s+/g, '');
    return /^\+?\d{10,20}$/.test(compact) || /^[A-Z]{2}\d{12,32}$/i.test(compact);
  }

  private looksLikeAmount(text: string): boolean {
    const normalized = text
      .trim()
      .replace(/\s+/g, '')
      .replace(/[$в‚¬ВЈв‚Ѕ]/g, '')
      .replace(/rub|ruble|СЂСѓР±/gi, '');
    return /^[+-]?\d{1,9}([.,]\d{1,2})?$/.test(normalized);
  }

  private targetValue(target: unknown): string {
    if (target === null || typeof target !== 'object') return '';
    const value = (target as Record<string, unknown>).value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
  }

  private fieldState(inputStates: FieldInputStateMap, target: unknown): FieldInputTrackingState | undefined {
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

  private manualInputMetadata(state: FieldInputTrackingState | undefined): Record<string, unknown> {
    if (state === undefined) return {};
    return {
      manualKeyCount: state.keyCount,
      keyCount: state.keyCount,
    };
  }
}
