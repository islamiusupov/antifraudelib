import { describe, expect, it, vi } from 'vitest';
import { BotDetectionCollectingService } from '../../../src/application/services/BotDetectionCollectingService';

describe('BotDetectionCollectingService', () => {
  it('collects BotD automation results when behavioral consent is present', async () => {
    const loadOptions: Record<string, unknown>[] = [];
    const loadBotD = vi.fn(async () => ({
      load: async (options?: Record<string, unknown>) => {
        loadOptions.push(options ?? {});
        return {
          detect: () => ({
            bot: true,
            botKind: 'selenium',
          }),
        };
      },
    }));
    const service = new BotDetectionCollectingService({
      loadBotD,
      isBrowser: () => true,
    });

    await expect(
      service.collect({
        consent: 'behavioral',
        botDetectionOptions: {
          monitoring: true,
        },
      }),
    ).resolves.toEqual({
      status: 'detected',
      provider: 'botd',
      botKind: 'selenium',
      reasonCodes: ['bot_detection_selenium'],
      metadata: {
        bot: true,
      },
    });
    expect(loadBotD).toHaveBeenCalledOnce();
    expect(loadOptions).toEqual([
      {
        monitoring: true,
      },
    ]);
  });

  it('normalizes missing BotD bot kind to unknown', async () => {
    await expect(collectWithDetection({ bot: true })).resolves.toMatchObject({
      status: 'detected',
      botKind: 'unknown',
      reasonCodes: ['bot_detection_unknown'],
    });
  });

  it('returns not_detected for human-like sessions', async () => {
    await expect(collectWithDetection({ bot: false })).resolves.toEqual({
      status: 'not_detected',
      provider: 'botd',
      botKind: undefined,
      reasonCodes: ['bot_detection_not_detected'],
      metadata: {
        bot: false,
      },
    });
  });

  it.each(['none', 'essential'] as const)('skips collection for %s consent without loading BotD', async (consent) => {
    const loadBotD = vi.fn();
    const service = new BotDetectionCollectingService({
      loadBotD,
      isBrowser: () => true,
    });

    await expect(service.collect({ consent })).resolves.toEqual({
      status: 'skipped',
      provider: 'botd',
      botKind: undefined,
      reasonCodes: ['bot_detection_consent_missing'],
      metadata: undefined,
    });
    expect(loadBotD).not.toHaveBeenCalled();
  });

  it('returns unavailable outside a browser runtime without loading BotD', async () => {
    const loadBotD = vi.fn();
    const service = new BotDetectionCollectingService({
      loadBotD,
      isBrowser: () => false,
    });

    await expect(service.collect({ consent: 'behavioral' })).resolves.toEqual({
      status: 'unavailable',
      provider: 'botd',
      botKind: undefined,
      reasonCodes: ['bot_detection_browser_unavailable'],
      metadata: undefined,
    });
    expect(loadBotD).not.toHaveBeenCalled();
  });

  it('returns error metadata when BotD loading or detection fails', async () => {
    const service = new BotDetectionCollectingService({
      loadBotD: async () => {
        throw new TypeError('botd import failed');
      },
      isBrowser: () => true,
    });

    await expect(service.collect({ consent: 'behavioral' })).resolves.toEqual({
      status: 'error',
      provider: 'botd',
      botKind: undefined,
      reasonCodes: ['bot_detection_collection_error'],
      metadata: {
        errorName: 'TypeError',
        errorMessage: 'botd import failed',
      },
    });
  });
});

function collectWithDetection(detection: { bot: boolean; botKind?: string }) {
  const service = new BotDetectionCollectingService({
    loadBotD: async () => ({
      load: async () => ({
        detect: () => detection,
      }),
    }),
    isBrowser: () => true,
  });

  return service.collect({ consent: 'behavioral' });
}
