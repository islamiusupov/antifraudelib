import { describe, expect, it } from 'vitest';
import { BotDetectionCollectingService } from '../../../src/application/services/BotDetectionCollectingService';
import { BotDetectionRiskFactorBuildingService } from '../../../src/application/services/BotDetectionRiskFactorBuildingService';
import { DeviceFingerprintCollectingService } from '../../../src/application/services/DeviceFingerprintCollectingService';
import { DeviceFingerprintRiskFactorBuildingService } from '../../../src/application/services/DeviceFingerprintRiskFactorBuildingService';
import { SessionSignalCollectingService } from '../../../src/application/services/SessionSignalCollectingService';

describe('SessionSignalCollectingService', () => {
  it('collects device fingerprint and BotD factors in stable session order', async () => {
    const service = new SessionSignalCollectingService(
      new DeviceFingerprintCollectingService({
        loadThumbmark: async () => ({
          Thumbmark: class {
            async get() {
              return { thumbmark: 'raw-device' };
            }
          },
        }),
        hashThumbmark: async (thumbmark) => `sha256:${thumbmark}`,
        isBrowser: () => true,
      }),
      new DeviceFingerprintRiskFactorBuildingService(),
      new BotDetectionCollectingService({
        loadBotD: async () => ({
          load: async () => ({
            detect: () => ({ bot: true, botKind: 'webdriver' }),
          }),
        }),
        isBrowser: () => true,
      }),
      new BotDetectionRiskFactorBuildingService(),
    );

    await expect(service.collect({ consent: 'behavioral' })).resolves.toEqual([
      expect.objectContaining({
        kind: 'device_fingerprint',
        status: 'inactive',
        contribution: 0,
        metadata: expect.objectContaining({
          deviceFingerprintHash: 'sha256:raw-device',
        }),
      }),
      expect.objectContaining({
        kind: 'bot_detection',
        status: 'ok',
        contribution: 50,
        reasonCodes: ['bot_detection_webdriver'],
      }),
    ]);
  });

  it('honors disabled session collectors', async () => {
    const service = new SessionSignalCollectingService(
      new DeviceFingerprintCollectingService({
        loadThumbmark: async () => {
          throw new Error('should not load thumbmark');
        },
        isBrowser: () => true,
      }),
      new DeviceFingerprintRiskFactorBuildingService(),
      new BotDetectionCollectingService({
        loadBotD: async () => ({
          load: async () => ({
            detect: () => ({ bot: false }),
          }),
        }),
        isBrowser: () => true,
      }),
      new BotDetectionRiskFactorBuildingService(),
    );

    await expect(
      service.collect({
        consent: 'behavioral',
        collectDeviceFingerprint: false,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        kind: 'bot_detection',
        status: 'inactive',
      }),
    ]);

    await expect(
      service.collect({
        consent: 'behavioral',
        collectDeviceFingerprint: false,
        collectBotDetection: false,
      }),
    ).resolves.toEqual([]);
  });
});
