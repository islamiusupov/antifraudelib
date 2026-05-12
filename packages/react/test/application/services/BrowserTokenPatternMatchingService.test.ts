import { describe, expect, it } from 'vitest';
import { BrowserTokenPatternMatchingService } from '../../../src/application/services/BrowserTokenPatternMatchingService';

describe('BrowserTokenPatternMatchingService', () => {
  it('detects token-like payloads in strings and structured bodies', () => {
    const service = new BrowserTokenPatternMatchingService();

    expect(service.hasTokenLikePayload('Authorization: Bearer secret')).toBe(true);
    expect(service.hasTokenLikePayload({ body: { access_token: 'abc' } })).toBe(true);
    expect(service.hasTokenLikePayload('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature')).toBe(true);
  });

  it('detects OTP-like clipboard payloads', () => {
    const service = new BrowserTokenPatternMatchingService();

    expect(service.hasOtpPattern('Код подтверждения 123456')).toBe(true);
    expect(service.hasOtpPattern({ otp: 9876 })).toBe(true);
  });

  it('does not flag ordinary text or cyclic payloads as tokens', () => {
    const service = new BrowserTokenPatternMatchingService();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(service.hasTokenLikePayload('ordinary transfer comment')).toBe(false);
    expect(service.hasOtpPattern('invoice number twelve')).toBe(false);
    expect(service.hasTokenLikePayload(cyclic)).toBe(false);
  });
});
