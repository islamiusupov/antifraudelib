import { describe, expect, it } from 'vitest';
import { PageVisibilityPatternCollectingService } from '../../../src/application/services/PageVisibilityPatternCollectingService';

describe('PageVisibilityPatternCollectingService', () => {
  it('detects frequent exits during payment form activity', () => {
    const service = new PageVisibilityPatternCollectingService();
    const state = service.createState();
    service.recordPaymentFormActivity(state, 0);

    [1000, 2000, 3000, 4000, 5000].forEach((atMs) => {
      service.collectExitMetadata(state, atMs, { source: 'window_blur' });
      service.collectReturnMetadata(state, atMs + 100, { source: 'window_focus' });
    });

    expect(service.collectExitMetadata(state, 6000)).toEqual(
      expect.objectContaining({
        reason: 'frequent_page_exits_during_payment_form',
        exitCount2m: 6,
        paymentFormActivity: true,
      }),
    );
  });

  it('blocks oscillation only after eight exits in five minutes', () => {
    const service = new PageVisibilityPatternCollectingService();
    const state = service.createState();
    service.recordPaymentFormActivity(state, 0);

    Array.from({ length: 7 }, (_item, index) => index * 10000).forEach((atMs) => {
      service.collectExitMetadata(state, atMs);
      service.collectReturnMetadata(state, atMs + 1000);
    });

    expect(service.collectExitMetadata(state, 70000)).toEqual(
      expect.objectContaining({
        reason: 'page_visibility_oscillation_block',
        exitCount5m: 8,
      }),
    );
  });

  it('allows a single short push-notification blur', () => {
    const service = new PageVisibilityPatternCollectingService();
    const state = service.createState();

    service.collectExitMetadata(state, 10000, { source: 'window_blur' });

    expect(service.collectReturnMetadata(state, 12000, { source: 'window_focus' })).toEqual(
      expect.objectContaining({
        reason: 'single_short_push_notification_blur',
        hiddenDurationMs: 2000,
      }),
    );
  });

  it('monitors repeated mobile notification blurs instead of stepping up', () => {
    const service = new PageVisibilityPatternCollectingService();
    const state = service.createState();
    const target = { navigator: { userAgent: 'Mobile Safari', maxTouchPoints: 5 } };

    [10000, 20000, 30000].forEach((atMs) => {
      service.collectExitMetadata(state, atMs, { target });
      service.collectReturnMetadata(state, atMs + 4000, { target });
    });

    expect(service.collectReturnMetadata(state, 44000, { target })).toEqual(
      expect.objectContaining({
        reason: 'mobile_notification_blur_monitor',
        mobileContext: true,
      }),
    );
  });

  it('detects paste immediately after return from another page', () => {
    const service = new PageVisibilityPatternCollectingService();
    const state = service.createState();

    service.collectExitMetadata(state, 1000);
    service.collectReturnMetadata(state, 6000);

    expect(service.collectActionMetadata(state, 'recipient_pasted', 6500)).toEqual(
      expect.objectContaining({
        reason: 'return_paste_iban_after_exit',
        returnToActionMs: 500,
      }),
    );
  });

  it('detects long absence followed by a fast action sequence', () => {
    const service = new PageVisibilityPatternCollectingService();
    const state = service.createState();

    service.collectExitMetadata(state, 0);
    service.collectReturnMetadata(state, 310000);
    expect(service.collectActionMetadata(state, 'input', 311000)).toBe(null);

    expect(service.collectActionMetadata(state, 'confirm_click', 312000)).toEqual(
      expect.objectContaining({
        reason: 'long_absence_fast_action_sequence',
      }),
    );
  });
});
