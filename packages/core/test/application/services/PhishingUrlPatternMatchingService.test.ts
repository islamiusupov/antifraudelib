import { describe, expect, it } from 'vitest';
import { PhishingUrlPatternMatchingService } from '../../../src/application/services/PhishingUrlPatternMatchingService';

describe('PhishingUrlPatternMatchingService', () => {
  it('detects bank typosquat URLs in DOM text', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://sberbank-online-secure.shop/login')).toContain(
      'phishing_url_typosquat_bank_brand',
    );
  });

  it('detects clipboard gosuslugi typosquat URLs', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://gosuslugi-confirm.com', { source: 'clipboard' })).toContain(
      'phishing_url_clipboard_gosuslugi_typosquat',
    );
  });

  it('detects newly registered domains from server metadata', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://fresh-domain.example/login', { domainAgeDays: 3 })).toContain(
      'phishing_url_new_domain_age_lt_7d',
    );
  });

  it('detects unicode homographs in bank domains', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://sberbank-\u043Enline.ru/login')).toContain(
      'phishing_url_unicode_homograph',
    );
  });

  it('detects suspicious TLDs combined with bank brands', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://sberbank-login.tk/pay')).toContain(
      'phishing_url_suspicious_tld_bank_brand',
    );
  });

  it('detects IP literal hosts', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('http://192.168.10.11/login')).toContain('phishing_url_ip_literal');
  });

  it('detects self-signed certificate metadata', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://bank-login.example', { selfSignedCertificate: true })).toContain(
      'phishing_url_self_signed_certificate',
    );
  });

  it('allows legitimate bank hostnames', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://sberbank.ru/online')).toEqual(['phishing_url_legitimate_bank']);
  });

  it('allows Google and Microsoft URLs in technical context', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://support.microsoft.com/help', { context: 'technical docs' })).toEqual([
      'phishing_url_technical_context_allow',
    ]);
  });

  it('allows bank partner whitelist domains', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://sbp.nspk.ru/qr')).toEqual(['phishing_url_bank_partner_whitelist']);
  });

  it('marks unexpanded shorteners for monitor', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://bit.ly/unknown')).toEqual(['phishing_url_shortener_needs_expansion']);
  });

  it('marks very long paths for monitor', () => {
    const service = new PhishingUrlPatternMatchingService();
    const longPath = 'a'.repeat(120);

    expect(service.match(`https://example.com/${longPath}`)).toEqual([
      'phishing_url_long_path_domain_hiding',
    ]);
  });

  it('allows bank custom protocol deeplinks', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('sberbankonline://payments')).toEqual(['phishing_url_custom_protocol_deeplink']);
  });

  it('detects punycode homographs', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.match('https://xn--80ak6aa92e.ru/login')).toEqual(['phishing_url_punycode_homograph']);
  });

  it('extracts plain and scheme URLs from text', () => {
    const service = new PhishingUrlPatternMatchingService();

    expect(service.extractUrls('Open sberbank-online-secure.shop or https://bit.ly/unknown.')).toEqual([
      'sberbank-online-secure.shop',
      'https://bit.ly/unknown',
    ]);
  });
});
