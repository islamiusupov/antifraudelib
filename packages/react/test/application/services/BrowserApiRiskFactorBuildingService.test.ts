import { describe, expect, it } from 'vitest';
import { BrowserApiRiskFactorBuildingService } from '../../../src/application/services/BrowserApiRiskFactorBuildingService';
import type { BrowserApiInterceptionEventEntity } from '../../../src/domain/browser/entities/BrowserApiInterceptionEventEntity';

describe('BrowserApiRiskFactorBuildingService', () => {
  it('builds Layer 2 factors from media, clipboard OTP, and token exfiltration events', () => {
    const service = new BrowserApiRiskFactorBuildingService();

    expect(
      service.build([
        event('media_requested', { audio: true, video: false }),
        event('clipboard_write', { hasOtpPattern: true }),
        event('fetch_requested', { hasTokenLikePayload: true }, false),
        event('xhr_requested', { hasTokenLikePayload: true }, true),
      ]),
    ).toEqual([
      expect.objectContaining({
        kind: 'concurrent_media',
        contribution: 35,
        reasonCodes: ['layer2_media_request'],
        metadata: { eventCount: 1 },
      }),
      expect.objectContaining({
        kind: 'clipboard_otp_pattern',
        contribution: 50,
        reasonCodes: ['clipboard_otp_pattern'],
        metadata: { eventCount: 1 },
      }),
      expect.objectContaining({
        kind: 'recent_token_injection',
        contribution: 40,
        reasonCodes: ['network_token_exfiltration'],
        metadata: { eventCount: 1 },
      }),
    ]);
  });

  it('ignores allowed network events and ordinary clipboard text', () => {
    const service = new BrowserApiRiskFactorBuildingService();

    expect(
      service.build([
        event('fetch_requested', { hasTokenLikePayload: true }, true),
        event('clipboard_read', { hasOtpPattern: false }),
      ]),
    ).toEqual([]);
  });
});

function event(
  kind: BrowserApiInterceptionEventEntity['kind'],
  metadata: Record<string, unknown>,
  allowed = false,
): BrowserApiInterceptionEventEntity {
  return {
    kind,
    atMs: 100,
    allowed,
    metadata,
  };
}
