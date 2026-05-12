import { describe, expect, it } from 'vitest';
import { DevEnvironmentSignalBuildingService } from '../../../src/application/services/DevEnvironmentSignalBuildingService';

describe('DevEnvironmentSignalBuildingService', () => {
  it.each([
    'devtools_console_external_log_activity',
    'devtools_console_long_js_paste',
    'devtools_opened_during_payment_form',
    'devtools_mobile_remote_debugging',
    'devtools_extension_auto_open',
  ])('adds a step-up boost for %s', (reasonCode) => {
    const service = new DevEnvironmentSignalBuildingService();

    expect(service.build([reasonCode], { source: 'console' })).toEqual([
      expect.objectContaining({
        kind: 'dev_environment',
        confidence: 1,
        reasonCodes: [reasonCode],
        metadata: { source: 'console' },
      }),
      expect.objectContaining({
        kind: 'composite_risk_boost',
        contribution: 45,
        maxContribution: 45,
        reasonCodes: ['devtools_step_up_floor'],
        metadata: {
          source: 'console',
          matchedReasonCodes: [reasonCode],
        },
      }),
    ]);
  });

  it.each([
    'webdriver_enabled',
    'phantomjs_callphantom_defined',
    'headless_devtools_test_stand',
  ])('adds a blocking bot floor for %s', (reasonCode) => {
    const service = new DevEnvironmentSignalBuildingService();

    expect(service.build([reasonCode]).map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]))
      .toEqual([
        ['bot_detection', undefined, reasonCode],
        ['composite_risk_boost', 35, 'devtools_bot_block_floor'],
      ]);
  });

  it('adds a blocking devtools floor for console self-XSS', () => {
    const service = new DevEnvironmentSignalBuildingService();

    expect(service.build(['devtools_self_xss_console_paste']).map((signal) => [
      signal.kind,
      signal.contribution,
      signal.reasonCodes?.[0],
    ])).toEqual([
      ['dev_environment', undefined, 'devtools_self_xss_console_paste'],
      ['composite_risk_boost', 70, 'devtools_block_floor'],
    ]);
  });

  it.each([
    'devtools_short_html_inspection',
    'firefox_responsive_design_mode',
  ])('keeps %s at monitor strength', (reasonCode) => {
    const service = new DevEnvironmentSignalBuildingService();

    expect(service.build([reasonCode]).map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0]]))
      .toEqual([
        ['dev_environment', undefined, reasonCode],
        ['composite_risk_boost', 15, 'devtools_monitor_floor'],
      ]);
  });

  it.each([
    'devtools_allowed_work_account',
    'devtools_not_opened_session',
    'devtools_post_transaction_open',
    'devtools_neighbor_developer_site',
  ])('keeps allow reason %s out of risk signals', (reasonCode) => {
    const service = new DevEnvironmentSignalBuildingService();

    expect(service.build([reasonCode])).toEqual([]);
  });

  it('does not let work-account allow suppress webdriver automation', () => {
    const service = new DevEnvironmentSignalBuildingService();

    expect(service.build(['devtools_allowed_work_account', 'webdriver_enabled']).map((signal) => signal.kind))
      .toEqual(['bot_detection', 'composite_risk_boost']);
  });
});
