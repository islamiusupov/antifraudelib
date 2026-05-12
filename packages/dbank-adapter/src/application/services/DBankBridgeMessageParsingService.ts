import type { DBankBridgeMessageEntity } from '../../domain/dbank/entities/DBankBridgeMessageEntity';
import type { DBankObservedEventKind } from '../../domain/value-objects/DBankObservedEventKind';

const DBANK_OBSERVED_EVENT_KINDS: DBankObservedEventKind[] = [
  'bank_opened',
  'transfer_opened',
  'recipient_pasted',
  'amount_pasted',
  'recipient_created',
  'transfer_submitted',
  'media_active',
  'warning_shown',
  'warning_confirmed',
  'warning_scrolled',
  'form_fill_order_observed',
  'page_hidden',
  'page_visible',
  'visual_challenge_started',
  'keystroke_anomaly_observed',
  'pointer_anomaly_observed',
  'rapid_scroll_observed',
  'native_tampering_observed',
  'dev_environment_observed',
  'bot_detected',
  'phishing_text_observed',
  'phishing_url_observed',
  'token_injection_observed',
  'client_environment_observed',
  'environment_conflict_observed',
  'device_fingerprint_observed',
  'server_factor_observed',
];

export class DBankBridgeMessageParsingService {
  parse(data: unknown): DBankBridgeMessageEntity | null {
    if (!this.isRecord(data)) return null;
    if (data.source !== 'd-bank' || data.type !== 'd-bank:event') return null;
    if (!this.isRecord(data.payload)) return null;
    if (!this.isObservedEventKind(data.payload.kind) || typeof data.payload.atMs !== 'number') return null;
    if (!Number.isFinite(data.payload.atMs)) return null;
    if (data.payload.metadata !== undefined && !this.isRecord(data.payload.metadata)) return null;

    return {
      source: 'd-bank',
      type: 'd-bank:event',
      payload: {
        kind: data.payload.kind,
        atMs: data.payload.atMs,
        metadata: data.payload.metadata,
      },
    };
  }

  private isObservedEventKind(value: unknown): value is DBankObservedEventKind {
    return typeof value === 'string' && DBANK_OBSERVED_EVENT_KINDS.includes(value as DBankObservedEventKind);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
