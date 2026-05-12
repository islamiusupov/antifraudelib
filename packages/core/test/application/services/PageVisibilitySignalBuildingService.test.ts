import { describe, expect, it } from 'vitest';
import { PageVisibilitySignalBuildingService } from '../../../src/application/services/PageVisibilitySignalBuildingService';

describe('PageVisibilitySignalBuildingService', () => {
  it('returns no signals for allow page visibility reasons', () => {
    const service = new PageVisibilitySignalBuildingService();

    expect(service.build([
      'single_short_push_notification_blur',
      'long_idle_without_switching_pattern',
      'minimized_during_page_load',
      'smooth_visibility_normal_pattern',
      'single_blur_session',
      'os_popup_focus_loss',
    ])).toEqual([]);
  });

  it('builds a step-up floor for suspicious page visibility patterns', () => {
    const service = new PageVisibilitySignalBuildingService();

    expect(
      service.build(['frequent_page_exits_during_payment_form'], { exitCount: 5 })
        .map((signal) => [signal.kind, signal.contribution, signal.reasonCodes?.[0], signal.metadata?.exitCount]),
    ).toEqual([
      ['page_visibility', undefined, 'frequent_page_exits_during_payment_form', 5],
      ['composite_risk_boost', 35, 'frequent_page_exits_during_payment_form', 5],
    ]);
  });

  it('builds a blocking floor for oscillation and return-paste patterns', () => {
    const service = new PageVisibilitySignalBuildingService();

    expect(
      service.build(['page_visibility_oscillation_block'])
        .map((signal) => [signal.kind, signal.contribution, signal.maxContribution, signal.reasonCodes?.[0]]),
    ).toEqual([
      ['page_visibility', undefined, undefined, 'page_visibility_oscillation_block'],
      ['composite_risk_boost', 60, 60, 'page_visibility_oscillation_block'],
    ]);
  });

  it('keeps edge cases at monitor-strength page visibility only', () => {
    const service = new PageVisibilitySignalBuildingService();

    expect(service.build(['mobile_notification_blur_monitor'])).toEqual([
      {
        kind: 'page_visibility',
        detected: true,
        confidence: 0.8,
        reasonCodes: ['mobile_notification_blur_monitor'],
        source: 'live',
        metadata: {},
      },
    ]);
  });

  it('normalizes duplicate and blank reason codes', () => {
    const service = new PageVisibilitySignalBuildingService();

    expect(
      service.build([' ', 'return_confirm_immediate_after_45s_exit', 'return_confirm_immediate_after_45s_exit'])
        .map((signal) => signal.reasonCodes),
    ).toEqual([
      ['return_confirm_immediate_after_45s_exit'],
      ['return_confirm_immediate_after_45s_exit'],
    ]);
  });
});
