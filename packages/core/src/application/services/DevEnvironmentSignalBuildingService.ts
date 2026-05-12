import type { RiskSignalEntity } from '../../domain/risk/entities/RiskSignalEntity';

const DEVTOOLS_MONITOR_BOOST_CONTRIBUTION = 15;
const DEVTOOLS_STEP_UP_BOOST_CONTRIBUTION = 45;
const DEVTOOLS_BLOCK_BOOST_CONTRIBUTION = 70;
const BOT_BLOCK_BOOST_CONTRIBUTION = 35;

const STEP_UP_REASON_CODES = new Set([
  'devtools_console_external_log_activity',
  'devtools_console_long_js_paste',
  'devtools_opened_during_payment_form',
  'devtools_mobile_remote_debugging',
  'devtools_extension_auto_open',
]);

const BOT_BLOCK_REASON_CODES = new Set([
  'webdriver_enabled',
  'phantomjs_callphantom_defined',
  'headless_devtools_test_stand',
]);

const DEVTOOLS_BLOCK_REASON_CODES = new Set([
  'devtools_self_xss_console_paste',
]);

const MONITOR_REASON_CODES = new Set([
  'devtools_short_html_inspection',
  'firefox_responsive_design_mode',
]);

const ALLOW_REASON_CODES = new Set([
  'devtools_allowed_work_account',
  'devtools_not_opened_session',
  'devtools_post_transaction_open',
  'devtools_neighbor_developer_site',
]);

export class DevEnvironmentSignalBuildingService {
  build(reasonCodes: string[], metadata: Record<string, unknown> = {}): RiskSignalEntity[] {
    const normalizedReasonCodes = this.uniqueNonEmpty(reasonCodes);
    const riskReasonCodes = this.riskReasonCodes(normalizedReasonCodes);
    if (riskReasonCodes.length === 0) return [];

    const botBlockReasonCodes = riskReasonCodes.filter((reasonCode) => BOT_BLOCK_REASON_CODES.has(reasonCode));
    const devtoolsBlockReasonCodes = riskReasonCodes.filter((reasonCode) => DEVTOOLS_BLOCK_REASON_CODES.has(reasonCode));
    const stepUpReasonCodes = riskReasonCodes.filter((reasonCode) => STEP_UP_REASON_CODES.has(reasonCode));
    const monitorReasonCodes = riskReasonCodes.filter((reasonCode) => MONITOR_REASON_CODES.has(reasonCode));

    if (botBlockReasonCodes.length > 0) {
      return this.botBlockSignals(riskReasonCodes, botBlockReasonCodes, metadata);
    }
    if (devtoolsBlockReasonCodes.length > 0) {
      return this.devtoolsSignals(riskReasonCodes, metadata, DEVTOOLS_BLOCK_BOOST_CONTRIBUTION, 'devtools_block_floor');
    }
    if (stepUpReasonCodes.length > 0) {
      return this.devtoolsSignals(riskReasonCodes, metadata, DEVTOOLS_STEP_UP_BOOST_CONTRIBUTION, 'devtools_step_up_floor');
    }
    if (monitorReasonCodes.length > 0) {
      return this.devtoolsSignals(riskReasonCodes, metadata, DEVTOOLS_MONITOR_BOOST_CONTRIBUTION, 'devtools_monitor_floor');
    }

    return [this.devEnvironmentSignal(riskReasonCodes, metadata)];
  }

  private riskReasonCodes(reasonCodes: string[]): string[] {
    const hasBlockingReason = reasonCodes.some((reasonCode) => (
      BOT_BLOCK_REASON_CODES.has(reasonCode) || DEVTOOLS_BLOCK_REASON_CODES.has(reasonCode)
    ));
    if (hasBlockingReason) return reasonCodes.filter((reasonCode) => !ALLOW_REASON_CODES.has(reasonCode));
    if (reasonCodes.some((reasonCode) => ALLOW_REASON_CODES.has(reasonCode))) return [];
    return reasonCodes;
  }

  private botBlockSignals(
    reasonCodes: string[],
    botBlockReasonCodes: string[],
    metadata: Record<string, unknown>,
  ): RiskSignalEntity[] {
    const signals: RiskSignalEntity[] = [
      {
        kind: 'bot_detection',
        detected: true,
        confidence: 1,
        reasonCodes: botBlockReasonCodes,
        source: 'live',
        metadata,
      },
    ];
    const devtoolsReasonCodes = reasonCodes.filter((reasonCode) => !BOT_BLOCK_REASON_CODES.has(reasonCode));
    if (devtoolsReasonCodes.length > 0) {
      signals.push(this.devEnvironmentSignal(devtoolsReasonCodes, metadata));
    }
    signals.push(this.boostSignal(BOT_BLOCK_BOOST_CONTRIBUTION, 'devtools_bot_block_floor', reasonCodes, metadata));
    return signals;
  }

  private devtoolsSignals(
    reasonCodes: string[],
    metadata: Record<string, unknown>,
    boostContribution: number,
    boostReasonCode: string,
  ): RiskSignalEntity[] {
    return [
      this.devEnvironmentSignal(reasonCodes, metadata),
      this.boostSignal(boostContribution, boostReasonCode, reasonCodes, metadata),
    ];
  }

  private devEnvironmentSignal(reasonCodes: string[], metadata: Record<string, unknown>): RiskSignalEntity {
    return {
      kind: 'dev_environment',
      detected: true,
      confidence: 1,
      reasonCodes,
      source: 'live',
      metadata,
    };
  }

  private boostSignal(
    contribution: number,
    reasonCode: string,
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

  private uniqueNonEmpty(values: string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter((value, index, items) => value !== '' && items.indexOf(value) === index);
  }
}
