import type { RiskSignalEntity } from '../../domain/risk/entities/RiskSignalEntity';
import { PhishingUrlPatternMatchingService } from './PhishingUrlPatternMatchingService';

const PHISHING_URL_STEP_UP_BOOST_CONTRIBUTION = 20;
const PHISHING_URL_BLOCK_BOOST_CONTRIBUTION = 45;
const PHISHING_URL_MONITOR_CONTRIBUTION = 25;
const PHISHING_URL_MONITOR_BOOST_CONTRIBUTION = 5;
const PHISHING_URL_FULL_CONFIDENCE = 1;

const STEP_UP_REASON_CODES = new Set([
  'phishing_url_pattern',
  'phishing_url_typosquat_bank_brand',
  'phishing_url_clipboard_gosuslugi_typosquat',
  'phishing_url_new_domain_age_lt_7d',
  'phishing_url_suspicious_tld_bank_brand',
  'phishing_url_ip_literal',
  'phishing_url_self_signed_certificate',
  'phishing_url_punycode_homograph',
]);

const BLOCK_REASON_CODES = new Set([
  'urlbert_phishing_high_confidence',
  'phishing_url_unicode_homograph',
  'phishing_url_text_composite',
  'phishing_url_copy_paste_recipient_composite',
  'phishing_url_concurrent_media_composite',
  'phishing_url_new_recipient_source_composite',
]);

const MONITOR_REASON_CODES = new Set([
  'phishing_url_shortener_needs_expansion',
  'phishing_url_long_path_domain_hiding',
]);

const ALLOW_REASON_CODES = new Set([
  'phishing_url_legitimate_bank',
  'phishing_url_technical_context_allow',
  'phishing_url_bank_partner_whitelist',
  'urlbert_benign_high_confidence',
  'phishing_url_custom_protocol_deeplink',
]);

const FALLBACK_REASON_CODES = new Set(['phishing_url', 'phishing_url_pattern']);

export class PhishingUrlSignalBuildingService {
  constructor(
    private readonly phishingUrlPatternMatchingService = new PhishingUrlPatternMatchingService(),
  ) {}

  build(reasonCodes: string[], metadata: Record<string, unknown> = {}): RiskSignalEntity[] {
    const normalizedReasonCodes = this.riskReasonCodes(this.sourceReasonCodes(reasonCodes, metadata));
    if (normalizedReasonCodes.length === 0) return [];

    const signals: RiskSignalEntity[] = [
      {
        kind: 'phishing_url',
        detected: true,
        confidence: PHISHING_URL_FULL_CONFIDENCE,
        reasonCodes: normalizedReasonCodes,
        source: 'live',
        metadata,
        ...this.phishingUrlContribution(normalizedReasonCodes),
      },
    ];

    if (normalizedReasonCodes.some((reasonCode) => BLOCK_REASON_CODES.has(reasonCode))) {
      signals.push(this.boostSignal(
        'phishing_url_block_floor',
        PHISHING_URL_BLOCK_BOOST_CONTRIBUTION,
        normalizedReasonCodes,
        metadata,
      ));
    } else if (normalizedReasonCodes.some((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode))) {
      signals.push(this.boostSignal(
        'phishing_url_step_up_floor',
        PHISHING_URL_STEP_UP_BOOST_CONTRIBUTION,
        normalizedReasonCodes,
        metadata,
      ));
    } else if (normalizedReasonCodes.some((reasonCode) => MONITOR_REASON_CODES.has(reasonCode))) {
      signals.push(this.boostSignal(
        'phishing_url_monitor_floor',
        PHISHING_URL_MONITOR_BOOST_CONTRIBUTION,
        normalizedReasonCodes,
        metadata,
      ));
    }

    return signals;
  }

  private sourceReasonCodes(reasonCodes: string[], metadata: Record<string, unknown>): string[] {
    const normalizedReasonCodes = this.uniqueNonEmpty(reasonCodes);
    const metadataReasonCodes = this.metadataReasonCodes(metadata);
    if (this.isFallbackOnly(normalizedReasonCodes) && metadataReasonCodes.length > 0) {
      return metadataReasonCodes;
    }
    return this.uniqueNonEmpty([...normalizedReasonCodes, ...metadataReasonCodes]);
  }

  private riskReasonCodes(reasonCodes: string[]): string[] {
    return this.uniqueNonEmpty(reasonCodes).filter((reasonCode) => !ALLOW_REASON_CODES.has(reasonCode));
  }

  private metadataReasonCodes(metadata: Record<string, unknown>): string[] {
    const records = this.metadataRecords(metadata);
    return this.uniqueNonEmpty(records.reduce<string[]>((reasonCodes, record) => [
      ...reasonCodes,
      ...this.recordReasonCodes(record),
      ...this.recordUrlReasonCodes(record),
    ], []));
  }

  private recordReasonCodes(metadata: Record<string, unknown>): string[] {
    const reasonCodes: string[] = [];
    const reason = metadata.reason;
    if (typeof reason === 'string' && reason.trim() !== '') {
      reasonCodes.push(reason);
    }
    const metadataReasonCodes = metadata.reasonCodes;
    if (Array.isArray(metadataReasonCodes)) {
      metadataReasonCodes
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
        .forEach((value) => reasonCodes.push(value));
    }
    return reasonCodes;
  }

  private recordUrlReasonCodes(metadata: Record<string, unknown>): string[] {
    const reasonCodes: string[] = [];
    this.recordUrls(metadata).forEach((url) => {
      reasonCodes.push(...this.phishingUrlPatternMatchingService.match(url, metadata));
    });
    return reasonCodes;
  }

  private recordUrls(metadata: Record<string, unknown>): string[] {
    const urls = new Set<string>();
    this.metadataStrings(metadata, ['url', 'href', 'sourceUrl', 'observedUrl', 'expandedUrl'])
      .forEach((url) => urls.add(url));
    this.metadataStrings(metadata, ['clipboardText', 'pastedText', 'text', 'contextText'])
      .forEach((text) => {
        this.phishingUrlPatternMatchingService.extractUrls(text)
          .forEach((url) => urls.add(url));
      });
    const metadataUrls = metadata.urls;
    if (Array.isArray(metadataUrls)) {
      metadataUrls
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
        .forEach((url) => urls.add(url));
    }
    return Array.from(urls);
  }

  private metadataRecords(metadata: Record<string, unknown>): Record<string, unknown>[] {
    const observations = metadata.observations;
    const observationRecords = Array.isArray(observations)
      ? observations.filter((observation): observation is Record<string, unknown> => this.isMetadataRecord(observation))
      : [];
    return [metadata, ...observationRecords];
  }

  private phishingUrlContribution(reasonCodes: string[]): Partial<RiskSignalEntity> {
    if (!reasonCodes.some((reasonCode) => MONITOR_REASON_CODES.has(reasonCode))) return {};
    if (reasonCodes.some((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode) || BLOCK_REASON_CODES.has(reasonCode))) {
      return {};
    }
    return {
      contribution: PHISHING_URL_MONITOR_CONTRIBUTION,
      maxContribution: 40,
    };
  }

  private boostSignal(
    reasonCode: string,
    contribution: number,
    matchedReasonCodes: string[],
    metadata: Record<string, unknown>,
  ): RiskSignalEntity {
    return {
      kind: 'composite_risk_boost',
      detected: true,
      contribution,
      maxContribution: contribution,
      reasonCodes: [reasonCode],
      source: 'live',
      metadata: {
        ...metadata,
        matchedReasonCodes,
      },
    };
  }

  private metadataStrings(metadata: Record<string, unknown>, keys: string[]): string[] {
    return keys
      .map((key) => metadata[key])
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  }

  private isFallbackOnly(reasonCodes: string[]): boolean {
    return reasonCodes.length > 0 && reasonCodes.every((reasonCode) => FALLBACK_REASON_CODES.has(reasonCode));
  }

  private uniqueNonEmpty(values: string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter((value, index, items) => value !== '' && items.indexOf(value) === index);
  }

  private isMetadataRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
