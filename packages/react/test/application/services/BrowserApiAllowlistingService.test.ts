import { describe, expect, it } from 'vitest';
import { BrowserApiAllowlistingService } from '../../../src/application/services/BrowserApiAllowlistingService';

describe('BrowserApiAllowlistingService', () => {
  it('allows URLs by string prefix and regular expression patterns', () => {
    const service = new BrowserApiAllowlistingService();

    expect(
      service.isAllowed('https://bank.example/api/transfer', [
        'https://bank.example/api/',
      ]),
    ).toBe(true);
    expect(
      service.isAllowed('https://static.bank.example/assets/app.js', [
        /^https:\/\/static\.bank\.example\//,
      ]),
    ).toBe(true);
  });

  it('rejects empty, unknown, and non-matching URLs', () => {
    const service = new BrowserApiAllowlistingService();

    expect(service.isAllowed(undefined, ['https://bank.example/'])).toBe(false);
    expect(service.isAllowed(' ', ['https://bank.example/'])).toBe(false);
    expect(service.isAllowed('https://evil.example/steal', ['https://bank.example/'])).toBe(false);
    expect(service.isAllowed('https://bank.example/api')).toBe(false);
  });
});
