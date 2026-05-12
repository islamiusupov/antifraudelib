const TOKEN_PATTERN = /(authorization|bearer|cookie|csrf|jwt|otp|password|refresh[_-]?token|access[_-]?token|session[_-]?id|token)/i;
const JWT_PATTERN = /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/;
const OTP_PATTERN = /\b\d{4,8}\b/;

export class BrowserTokenPatternMatchingService {
  hasTokenLikePayload(payload: unknown): boolean {
    const text = this.stringify(payload);
    return TOKEN_PATTERN.test(text) || JWT_PATTERN.test(text);
  }

  hasOtpPattern(payload: unknown): boolean {
    return OTP_PATTERN.test(this.stringify(payload));
  }

  private stringify(payload: unknown): string {
    if (payload === undefined || payload === null) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'number' || typeof payload === 'boolean' || typeof payload === 'bigint') {
      return String(payload);
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }
}
