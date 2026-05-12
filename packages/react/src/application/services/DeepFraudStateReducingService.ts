import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import { RiskScoringService } from '@deepcode/antifraud-core';
import type { DeepFraudRootConfigEntity } from '../../domain/common/entities/DeepFraudRootConfigEntity';
import type { DeepFraudStateEntity } from '../../domain/common/entities/DeepFraudStateEntity';

const KEYSTROKE_COMPOSITE_BLOCK_BOOST_CONTRIBUTION = 35;
const KEYSTROKE_COMPOSITE_STEP_UP_BOOST_CONTRIBUTION = 20;
const KEYSTROKE_MEDIA_PAGE_EXITS_BOOST_CONTRIBUTION = 10;
const POINTER_NATIVE_TAMPERING_BLOCK_BOOST_CONTRIBUTION = 25;
const POINTER_BOT_DETECTION_BLOCK_BOOST_CONTRIBUTION = 15;
const POINTER_SCREEN_SHARING_BLOCK_BOOST_CONTRIBUTION = 53;
const POINTER_FAST_FORM_BLOCK_BOOST_CONTRIBUTION = 65;
const DEVTOOLS_COMPOSITE_BOOST_CONTRIBUTION = 10;
const PHISHING_URL_COMPOSITE_BLOCK_BOOST_CONTRIBUTION = 45;
const PAGE_VISIBILITY_COMPOSITE_BOOST_CONTRIBUTION = 10;
const COPY_PASTE_FACTOR_KINDS = ['copy_paste_recipient', 'copy_paste_amount'];

export class DeepFraudStateReducingService {
  private readonly riskScoringService = new RiskScoringService();

  createInitialState(config: DeepFraudRootConfigEntity): DeepFraudStateEntity {
    const rootFactors = config.factors ?? [];
    return this.createState(config.userId, config.consent, rootFactors, {}, this.addCompositeFactors(this.deduplicateFactors(rootFactors)));
  }

  replaceScopeFactors(
    state: DeepFraudStateEntity,
    scope: RiskScope,
    factors: RiskFactorEntity[],
  ): DeepFraudStateEntity {
    const scopedFactors = {
      ...state.scopedFactors,
      [scope]: factors,
    };
    const allFactors = this.collectFactors(state.rootFactors, scopedFactors);
    return this.createState(state.userId, state.consent, state.rootFactors, scopedFactors, allFactors);
  }

  private createState(
    userId: string,
    consent: DeepFraudStateEntity['consent'],
    rootFactors: RiskFactorEntity[],
    scopedFactors: DeepFraudStateEntity['scopedFactors'],
    factors: RiskFactorEntity[],
  ): DeepFraudStateEntity {
    return {
      userId,
      consent,
      rootFactors,
      scopedFactors,
      factors,
      assessment: this.riskScoringService.score({
        scope: 'transaction',
        factors,
      }),
    };
  }

  private collectFactors(
    rootFactors: RiskFactorEntity[],
    scopedFactors: DeepFraudStateEntity['scopedFactors'],
  ): RiskFactorEntity[] {
    const factors = [...rootFactors];
    Object.keys(scopedFactors).forEach((scope) => {
      const scopeFactors = scopedFactors[scope as RiskScope] ?? [];
      factors.push(...scopeFactors);
    });
    return this.addCompositeFactors(this.deduplicateFactors(factors));
  }

  private addCompositeFactors(factors: RiskFactorEntity[]): RiskFactorEntity[] {
    let compositeFactors = factors;
    const phishingUrlCompositeReasonCode = this.phishingUrlCompositeReasonCode(factors);
    if (phishingUrlCompositeReasonCode !== null) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        phishingUrlCompositeReasonCode,
        PHISHING_URL_COMPOSITE_BLOCK_BOOST_CONTRIBUTION,
      );
    }
    if (
      this.hasFactor(factors, 'new_recipient') &&
      this.hasFactor(factors, 'copy_paste_recipient') &&
      this.hasFactor(factors, 'concurrent_media')
    ) {
      compositeFactors = this.withCompositeBoost(compositeFactors, 'new_recipient_copy_paste_concurrent_media_composite');
    }
    if (
      this.hasFactor(factors, 'new_recipient') &&
      this.hasFactor(factors, 'phishing_text_dom') &&
      this.hasFactor(factors, 'warning_dwell')
    ) {
      compositeFactors = this.withCompositeBoost(compositeFactors, 'new_recipient_phishing_warning_skip_composite');
    }
    if (
      this.hasFactor(factors, 'new_recipient') &&
      this.hasFactor(factors, 'page_visibility') &&
      this.hasFactor(factors, 'amount_anomaly')
    ) {
      compositeFactors = this.withCompositeBoost(compositeFactors, 'new_recipient_page_visibility_amount_composite');
    }
    if (
      this.hasFrequentPageExitFactor(factors) &&
      this.hasFactor(factors, 'concurrent_media') &&
      this.hasCopyPasteFactor(factors)
    ) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'page_exits_media_copy_paste_composite',
        PAGE_VISIBILITY_COMPOSITE_BOOST_CONTRIBUTION,
      );
    }
    if (
      this.hasFrequentPageExitFactor(factors) &&
      this.hasKeystrokePauseFactor(factors)
    ) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'page_exits_keystroke_pause_composite',
        PAGE_VISIBILITY_COMPOSITE_BOOST_CONTRIBUTION,
      );
    }
    if (
      this.hasLongAbsencePageVisibilityFactor(factors) &&
      this.hasFactor(factors, 'new_recipient') &&
      this.hasFactor(factors, 'phishing_text_dom')
    ) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'long_absence_new_recipient_phishing_composite',
        PAGE_VISIBILITY_COMPOSITE_BOOST_CONTRIBUTION,
      );
    }
    if (
      this.hasFactor(factors, 'keystroke_dynamics') &&
      this.hasFactor(factors, 'concurrent_media') &&
      this.hasFactor(factors, 'page_visibility')
    ) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'keystroke_concurrent_media_page_exits_composite',
        KEYSTROKE_MEDIA_PAGE_EXITS_BOOST_CONTRIBUTION,
      );
    }
    if (
      this.hasFactor(factors, 'keystroke_dynamics') &&
      this.hasCopyPasteFactor(factors) &&
      this.hasNoManualInputEvidence(factors)
    ) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'keystroke_copy_paste_no_manual_input_composite',
        KEYSTROKE_COMPOSITE_STEP_UP_BOOST_CONTRIBUTION,
      );
    }
    if (
      this.hasFactor(factors, 'keystroke_dynamics') &&
      this.hasFirstTimeDeviceFactor(factors)
    ) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'keystroke_first_time_device_composite',
        KEYSTROKE_COMPOSITE_BLOCK_BOOST_CONTRIBUTION,
      );
    }
    if (this.hasFactor(factors, 'pointer_pattern') && this.hasFactor(factors, 'native_tampering')) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'pointer_native_tampering_composite',
        POINTER_NATIVE_TAMPERING_BLOCK_BOOST_CONTRIBUTION,
      );
    }
    if (this.hasFactor(factors, 'pointer_pattern') && this.hasFactor(factors, 'bot_detection')) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'pointer_bot_detection_composite',
        POINTER_BOT_DETECTION_BLOCK_BOOST_CONTRIBUTION,
      );
    }
    if (this.hasFactor(factors, 'pointer_pattern') && this.hasScreenSharingHeuristicFactor(factors)) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'pointer_screen_sharing_composite',
        POINTER_SCREEN_SHARING_BLOCK_BOOST_CONTRIBUTION,
      );
    }
    if (this.hasFastReadingFormPointerFactor(factors)) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'pointer_fast_form_completion_composite',
        POINTER_FAST_FORM_BLOCK_BOOST_CONTRIBUTION,
      );
    }
    if (this.hasAnyFactorReasonCode(factors, [
      'devtools_console_long_js_paste',
      'devtools_self_xss_console_paste',
    ]) && this.hasFactor(factors, 'new_recipient')) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'devtools_js_paste_new_recipient_composite',
        DEVTOOLS_COMPOSITE_BOOST_CONTRIBUTION,
      );
    }
    if (this.hasDevToolsFactor(factors) && this.hasAnyFactorReasonCode(factors, ['webdriver_enabled'])) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'devtools_webdriver_harvesting_composite',
        DEVTOOLS_COMPOSITE_BOOST_CONTRIBUTION,
      );
    }
    if (
      this.hasDevToolsFactor(factors) &&
      this.hasFactor(factors, 'concurrent_media') &&
      this.hasFactor(factors, 'warning_dwell')
    ) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'devtools_media_warning_skip_composite',
        DEVTOOLS_COMPOSITE_BOOST_CONTRIBUTION,
      );
    }
    if (this.hasDevToolsFactor(factors) && this.hasConsolePhishingTextFactor(factors)) {
      compositeFactors = this.withCompositeBoost(
        compositeFactors,
        'devtools_console_phishing_output_composite',
        DEVTOOLS_COMPOSITE_BOOST_CONTRIBUTION,
      );
    }
    return compositeFactors;
  }

  private withCompositeBoost(
    factors: RiskFactorEntity[],
    reasonCode: string,
    contribution = 10,
  ): RiskFactorEntity[] {
    const nextCompositeFactor: RiskFactorEntity = {
      kind: 'composite_risk_boost',
      contribution,
      maxContribution: contribution,
      status: 'ok',
      source: 'live',
      reasonCodes: [reasonCode],
    };
    const existingCompositeFactor = factors.find((factor) => factor.kind === 'composite_risk_boost');
    if (existingCompositeFactor === undefined) return [...factors, nextCompositeFactor];

    return factors.map((factor) => (
      factor.kind === 'composite_risk_boost'
        ? this.mergeFactor(factor, nextCompositeFactor)
        : factor
    ));
  }

  private hasFactor(factors: RiskFactorEntity[], kind: RiskFactorEntity['kind']): boolean {
    return factors.some((factor) => factor.kind === kind && (factor.status ?? 'ok') === 'ok' && factor.contribution > 0);
  }

  private hasCopyPasteFactor(factors: RiskFactorEntity[]): boolean {
    return factors.some((factor) => COPY_PASTE_FACTOR_KINDS.includes(factor.kind) && this.isScoringFactor(factor));
  }

  private hasFrequentPageExitFactor(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => factor.kind === 'page_visibility' && this.isScoringFactor(factor))
      .some((factor) => this.hasAnyReasonCode(factor, [
        'frequent_page_exits_during_payment_form',
        'page_visibility_oscillation',
        'page_visibility_oscillation_block',
      ]));
  }

  private hasLongAbsencePageVisibilityFactor(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => factor.kind === 'page_visibility' && this.isScoringFactor(factor))
      .some((factor) => (
        this.hasReasonCode(factor, 'long_absence_fast_action_sequence') ||
        this.metadataHasNumberAtLeast(factor.metadata, 'hiddenDurationMs', 5 * 60 * 1000)
      ));
  }

  private hasKeystrokePauseFactor(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => factor.kind === 'keystroke_dynamics' && this.isScoringFactor(factor))
      .some((factor) => this.hasAnyReasonCode(factor, [
        'long_keystroke_pause_instruction_pattern',
      ]));
  }

  private hasNoManualInputEvidence(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => (
        factor.kind === 'keystroke_dynamics' ||
        COPY_PASTE_FACTOR_KINDS.includes(factor.kind)
      ))
      .some((factor) => (
        this.hasReasonCode(factor, 'no_manual_input') ||
        this.metadataHasZeroNumber(factor.metadata, ['manualKeyCount', 'keyCount'])
      ));
  }

  private hasFirstTimeDeviceFactor(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => factor.kind === 'device_fingerprint' && this.isScoringFactor(factor))
      .some((factor) => (
        this.hasReasonCode(factor, 'first_time_device') ||
        this.metadataHasTrueFlag(factor.metadata, 'firstSeenDevice')
      ));
  }

  private phishingUrlCompositeReasonCode(factors: RiskFactorEntity[]): string | null {
    if (!this.hasFactor(factors, 'phishing_url')) return null;
    if (this.hasFactor(factors, 'phishing_text_dom')) return 'phishing_url_text_composite';
    if (this.hasFactor(factors, 'copy_paste_recipient')) return 'phishing_url_copy_paste_recipient_composite';
    if (this.hasFactor(factors, 'concurrent_media')) return 'phishing_url_concurrent_media_composite';
    if (this.hasNewRecipientLinkedToPhishingUrl(factors)) return 'phishing_url_new_recipient_source_composite';
    return null;
  }

  private hasNewRecipientLinkedToPhishingUrl(factors: RiskFactorEntity[]): boolean {
    const phishingUrlFactors = factors.filter((factor) => factor.kind === 'phishing_url' && this.isScoringFactor(factor));
    if (phishingUrlFactors.length === 0) return false;
    const phishingUrls = new Set(phishingUrlFactors.reduce<string[]>((urls, factor) => [
      ...urls,
      ...this.factorMetadataStrings(factor, [
        'url',
        'sourceUrl',
        'observedUrl',
      ]),
    ], []));
    const phishingReasonCodes = new Set(phishingUrlFactors.reduce<string[]>((reasonCodes, factor) => [
      ...reasonCodes,
      ...(factor.reasonCodes ?? []),
      ...this.factorMetadataStrings(factor, ['reason', 'sourceReason']),
    ], []));

    return factors
      .filter((factor) => factor.kind === 'new_recipient' && this.isScoringFactor(factor))
      .some((factor) => (
        this.factorMetadataStrings(factor, ['sourceUrl', 'url'])
          .some((url) => phishingUrls.has(url)) ||
        this.factorMetadataStrings(factor, ['sourceReason'])
          .some((reasonCode) => phishingReasonCodes.has(reasonCode)) ||
        this.metadataHasStringValue(factor.metadata, 'sourceFactor', 'phishing_url') ||
        this.metadataHasStringValue(factor.metadata, 'sourceKind', 'phishing_url')
      ));
  }

  private hasScreenSharingHeuristicFactor(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => this.isScoringFactor(factor))
      .some((factor) => (
        factor.kind === 'screen_sharing' ||
        (
          (factor.kind === 'client_environment' || factor.kind === 'concurrent_media') &&
          (
            this.hasReasonCode(factor, 'screen_sharing_heuristic') ||
            this.hasReasonCode(factor, 'screen_sharing_observed') ||
            this.hasReasonCode(factor, 'screen_share_active') ||
            this.hasReasonCode(factor, 'screen_sharing')
          )
        )
      ));
  }

  private hasFastReadingFormPointerFactor(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => factor.kind === 'pointer_pattern' && this.isScoringFactor(factor))
      .some((factor) => (
        this.metadataHasTrueFlag(factor.metadata, 'formRequiresReading') &&
        this.metadataHasNumberBelow(factor.metadata, 'formDurationMs', 5000)
      ));
  }

  private hasDevToolsFactor(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => this.isScoringFactor(factor))
      .some((factor) => (
        factor.kind === 'dev_environment' ||
        this.hasAnyReasonCode(factor, [
          'devtools_step_up_floor',
          'devtools_block_floor',
          'devtools_bot_block_floor',
          'devtools_console_external_log_activity',
          'devtools_console_long_js_paste',
          'devtools_opened_during_payment_form',
          'devtools_mobile_remote_debugging',
          'devtools_extension_auto_open',
        ])
      ));
  }

  private hasConsolePhishingTextFactor(factors: RiskFactorEntity[]): boolean {
    return factors
      .filter((factor) => factor.kind === 'phishing_text_dom' && this.isScoringFactor(factor))
      .some((factor) => (
        this.metadataHasText(factor.metadata, ['source', 'channel', 'surface'], /console|devtools/i) ||
        this.hasReasonCode(factor, 'phishing_text_console_output')
      ));
  }

  private isScoringFactor(factor: RiskFactorEntity): boolean {
    return (factor.status ?? 'ok') === 'ok' && factor.contribution > 0;
  }

  private hasReasonCode(factor: RiskFactorEntity, reasonCode: string): boolean {
    return (factor.reasonCodes ?? []).includes(reasonCode) || this.metadataHasReasonCode(factor.metadata, reasonCode);
  }

  private hasAnyReasonCode(factor: RiskFactorEntity, reasonCodes: string[]): boolean {
    return reasonCodes.some((reasonCode) => this.hasReasonCode(factor, reasonCode));
  }

  private hasAnyFactorReasonCode(factors: RiskFactorEntity[], reasonCodes: string[]): boolean {
    return factors.some((factor) => this.isScoringFactor(factor) && this.hasAnyReasonCode(factor, reasonCodes));
  }

  private metadataHasReasonCode(metadata: Record<string, unknown> | undefined, reasonCode: string): boolean {
    return this.metadataRecords(metadata).some((record) => {
      if (record.reason === reasonCode) return true;
      const reasonCodes = record.reasonCodes;
      return Array.isArray(reasonCodes) && reasonCodes.includes(reasonCode);
    });
  }

  private metadataHasZeroNumber(metadata: Record<string, unknown> | undefined, keys: string[]): boolean {
    return this.metadataRecords(metadata).some((record) => (
      keys.some((key) => record[key] === 0)
    ));
  }

  private metadataHasTrueFlag(metadata: Record<string, unknown> | undefined, key: string): boolean {
    return this.metadataRecords(metadata).some((record) => record[key] === true);
  }

  private metadataHasStringValue(
    metadata: Record<string, unknown> | undefined,
    key: string,
    expectedValue: string,
  ): boolean {
    return this.metadataRecords(metadata).some((record) => record[key] === expectedValue);
  }

  private factorMetadataStrings(factor: RiskFactorEntity, keys: string[]): string[] {
    return this.metadataRecords(factor.metadata)
      .reduce<unknown[]>((values, record) => [
        ...values,
        ...keys.map((key) => record[key]),
      ], [])
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  }

  private metadataHasNumberBelow(
    metadata: Record<string, unknown> | undefined,
    key: string,
    maximumExclusive: number,
  ): boolean {
    return this.metadataRecords(metadata).some((record) => (
      typeof record[key] === 'number' &&
      Number.isFinite(record[key]) &&
      record[key] < maximumExclusive
    ));
  }

  private metadataHasNumberAtLeast(
    metadata: Record<string, unknown> | undefined,
    key: string,
    minimumInclusive: number,
  ): boolean {
    return this.metadataRecords(metadata).some((record) => (
      typeof record[key] === 'number' &&
      Number.isFinite(record[key]) &&
      record[key] >= minimumInclusive
    ));
  }

  private metadataHasText(
    metadata: Record<string, unknown> | undefined,
    keys: string[],
    pattern: RegExp,
  ): boolean {
    return this.metadataRecords(metadata).some((record) => keys.some((key) => {
      const value = record[key];
      return typeof value === 'string' && pattern.test(value);
    }));
  }

  private metadataRecords(metadata: Record<string, unknown> | undefined): Record<string, unknown>[] {
    if (metadata === undefined) return [];
    const observations = metadata.observations;
    if (!Array.isArray(observations)) return [metadata];
    return [
      metadata,
      ...observations.filter((observation): observation is Record<string, unknown> => (
        typeof observation === 'object' && observation !== null && !Array.isArray(observation)
      )),
    ];
  }

  private deduplicateFactors(factors: RiskFactorEntity[]): RiskFactorEntity[] {
    const factorsByKind = new Map<string, RiskFactorEntity>();

    factors.forEach((factor) => {
      const existingFactor = factorsByKind.get(factor.kind);
      if (existingFactor === undefined) {
        factorsByKind.set(factor.kind, factor);
        return;
      }

      factorsByKind.set(factor.kind, this.mergeFactor(existingFactor, factor));
    });

    return Array.from(factorsByKind.values());
  }

  private mergeFactor(left: RiskFactorEntity, right: RiskFactorEntity): RiskFactorEntity {
    const selectedFactor = right.contribution > left.contribution ? right : left;
    const metadata = this.mergeMetadata(left.metadata, right.metadata);

    return {
      ...selectedFactor,
      contribution: Math.max(left.contribution, right.contribution),
      maxContribution: Math.max(left.maxContribution ?? left.contribution, right.maxContribution ?? right.contribution),
      reasonCodes: this.uniqueReasonCodes(left.reasonCodes, right.reasonCodes),
      ...(metadata !== undefined ? { metadata } : {}),
    };
  }

  private mergeMetadata(
    leftMetadata: RiskFactorEntity['metadata'],
    rightMetadata: RiskFactorEntity['metadata'],
  ): RiskFactorEntity['metadata'] {
    if (leftMetadata === undefined) return rightMetadata;
    if (rightMetadata === undefined) return leftMetadata;

    const observations = [
      ...this.metadataObservationRecords(leftMetadata),
      ...this.metadataObservationRecords(rightMetadata),
    ];
    return {
      ...leftMetadata,
      ...rightMetadata,
      ...(observations.length > 0 ? { observations } : {}),
    };
  }

  private metadataObservationRecords(metadata: Record<string, unknown>): Record<string, unknown>[] {
    const observations = metadata.observations;
    if (!Array.isArray(observations)) return [];
    return observations.filter((observation): observation is Record<string, unknown> => (
      typeof observation === 'object' && observation !== null && !Array.isArray(observation)
    ));
  }

  private uniqueReasonCodes(
    leftReasonCodes: RiskFactorEntity['reasonCodes'],
    rightReasonCodes: RiskFactorEntity['reasonCodes'],
  ): string[] {
    return Array.from(new Set([...(leftReasonCodes ?? []), ...(rightReasonCodes ?? [])]));
  }
}
