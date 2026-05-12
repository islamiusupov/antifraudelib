const BANK_BRAND_TOKENS = ['sberbank', 'sber', 'tinkoff', 'vtb', 'alfabank', 'gazprombank'];
const GOSUSLUGI_TOKENS = ['gosuslugi', 'gosuslugy'];
const SUSPICIOUS_TLDS = ['tk', 'ml', 'ga', 'cf', 'gq'];
const SHORTENER_HOSTNAMES = ['bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'is.gd', 'clck.ru'];
const LEGITIMATE_BANK_HOSTNAMES = [
  'sberbank.ru',
  'sber.ru',
  'online.sberbank.ru',
  'tbank.ru',
  'tinkoff.ru',
  'vtb.ru',
  'alfabank.ru',
  'gazprombank.ru',
];
const BANK_PARTNER_HOSTNAMES = [
  'mirpay.ru',
  'mironline.ru',
  'pay.mironline.ru',
  'nspk.ru',
  'sbp.nspk.ru',
  'qr.nspk.ru',
];
const TECHNICAL_CONTEXT_HOSTNAMES = [
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'microsoft.com',
  'office.com',
  'live.com',
  'azure.com',
  'windows.net',
];
const CUSTOM_PROTOCOL_ALLOWLIST = ['sberbankonline:', 'sbol:', 'mirpay:', 'sbp:'];
const TECHNICAL_CONTEXT_PATTERN = /\b(api|docs?|developer|console|oauth|sso|support|ticket|technical|troubleshooting)\b/i;
const URL_CANDIDATE_PATTERN =
  /((?:https?:\/\/|[a-z][a-z0-9+.-]*:\/\/)[^\s<>"']+|(?:[a-z0-9\u0400-\u04ff](?:[a-z0-9\u0400-\u04ff-]{0,61}[a-z0-9\u0400-\u04ff])?\.)+[a-z\u0400-\u04ff]{2,}(?:\/[^\s<>"']*)?)/gi;
const CYRILLIC_PATTERN = /[\u0400-\u04ff]/;
const CYRILLIC_HOMOGLYPHS: Record<string, string> = {
  '\u0430': 'a',
  '\u0410': 'a',
  '\u0435': 'e',
  '\u0415': 'e',
  '\u043E': 'o',
  '\u041E': 'o',
  '\u0440': 'p',
  '\u0420': 'p',
  '\u0441': 'c',
  '\u0421': 'c',
  '\u0443': 'y',
  '\u0423': 'y',
  '\u0445': 'x',
  '\u0425': 'x',
  '\u0456': 'i',
  '\u0406': 'i',
};

export class PhishingUrlPatternMatchingService {
  match(rawUrl: string, metadata: Record<string, unknown> = {}): string[] {
    const url = this.parseUrl(rawUrl);
    if (url === null) return [];

    if (this.isAllowedCustomProtocol(url)) {
      return ['phishing_url_custom_protocol_deeplink'];
    }

    const hostname = url.hostname.toLowerCase();
    const rawHostname = this.rawHostname(rawUrl).toLowerCase();
    const riskReasonCodes = this.unique([
      ...this.explicitRiskReasonCodes(metadata),
      ...this.urlRiskReasonCodes(url, rawHostname, metadata),
    ]);
    if (riskReasonCodes.length > 0) return riskReasonCodes;

    return this.urlAllowReasonCodes(hostname, metadata);
  }

  extractUrls(text: string): string[] {
    const urls = new Set<string>();
    URL_CANDIDATE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_CANDIDATE_PATTERN.exec(text)) !== null) {
      const url = this.stripTrailingPunctuation(match[0]);
      if (this.parseUrl(url) !== null) {
        urls.add(url);
      }
    }
    return Array.from(urls);
  }

  private urlRiskReasonCodes(url: URL, rawHostname: string, metadata: Record<string, unknown>): string[] {
    const hostname = url.hostname.toLowerCase();
    const reasonCodes: string[] = [];

    if (this.isRecentlyRegisteredDomain(metadata)) {
      reasonCodes.push('phishing_url_new_domain_age_lt_7d');
    }
    if (this.hasSelfSignedCertificateSignal(metadata)) {
      reasonCodes.push('phishing_url_self_signed_certificate');
    }
    if (this.isUnicodeHomograph(rawHostname)) {
      reasonCodes.push('phishing_url_unicode_homograph');
    } else if (hostname.includes('xn--')) {
      reasonCodes.push('phishing_url_punycode_homograph');
    }
    if (this.isIpLiteral(hostname)) {
      reasonCodes.push('phishing_url_ip_literal');
    }
    if (this.isGosuslugiTyposquat(hostname)) {
      reasonCodes.push('phishing_url_clipboard_gosuslugi_typosquat');
    }
    if (this.isSuspiciousTldBankBrand(hostname)) {
      reasonCodes.push('phishing_url_suspicious_tld_bank_brand');
    }
    if (this.isBankBrandTyposquat(hostname)) {
      reasonCodes.push('phishing_url_typosquat_bank_brand');
    }
    if (this.isUnexpandedShortener(hostname, metadata)) {
      reasonCodes.push('phishing_url_shortener_needs_expansion');
    }
    if (this.isLongPathDomainHiding(url)) {
      reasonCodes.push('phishing_url_long_path_domain_hiding');
    }

    return reasonCodes;
  }

  private explicitRiskReasonCodes(metadata: Record<string, unknown>): string[] {
    const reasonCodes = this.metadataReasonCodes(metadata);
    return reasonCodes.filter((reasonCode) => !this.isAllowReasonCode(reasonCode));
  }

  private urlAllowReasonCodes(hostname: string, metadata: Record<string, unknown>): string[] {
    if (this.isAllowedHostname(hostname, LEGITIMATE_BANK_HOSTNAMES)) {
      return ['phishing_url_legitimate_bank'];
    }
    if (this.isAllowedHostname(hostname, BANK_PARTNER_HOSTNAMES)) {
      return ['phishing_url_bank_partner_whitelist'];
    }
    if (this.isAllowedHostname(hostname, TECHNICAL_CONTEXT_HOSTNAMES) && this.isTechnicalContext(metadata)) {
      return ['phishing_url_technical_context_allow'];
    }
    return this.metadataReasonCodes(metadata).filter((reasonCode) => this.isAllowReasonCode(reasonCode));
  }

  private isBankBrandTyposquat(hostname: string): boolean {
    if (this.isAllowedHostname(hostname, LEGITIMATE_BANK_HOSTNAMES)) return false;
    const hasBrand = BANK_BRAND_TOKENS.some((token) => hostname.includes(token));
    if (!hasBrand) return false;
    return /[-_]/.test(hostname) || /(secure|confirm|verify|online|support|account)/.test(hostname);
  }

  private isGosuslugiTyposquat(hostname: string): boolean {
    if (this.isAllowedHostname(hostname, ['gosuslugi.ru'])) return false;
    return GOSUSLUGI_TOKENS.some((token) => hostname.includes(token));
  }

  private isSuspiciousTldBankBrand(hostname: string): boolean {
    const tld = hostname.split('.').pop() ?? '';
    if (!SUSPICIOUS_TLDS.includes(tld)) return false;
    return BANK_BRAND_TOKENS.some((token) => hostname.includes(token));
  }

  private isUnicodeHomograph(rawHostname: string): boolean {
    if (!CYRILLIC_PATTERN.test(rawHostname)) return false;
    const skeleton = Array.from(rawHostname)
      .map((character) => CYRILLIC_HOMOGLYPHS[character] ?? character)
      .join('');
    return BANK_BRAND_TOKENS.some((token) => skeleton.includes(token)) ||
      GOSUSLUGI_TOKENS.some((token) => skeleton.includes(token));
  }

  private isIpLiteral(hostname: string): boolean {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  }

  private isUnexpandedShortener(hostname: string, metadata: Record<string, unknown>): boolean {
    if (!this.isAllowedHostname(hostname, SHORTENER_HOSTNAMES)) return false;
    return this.metadataString(metadata, ['expandedUrl', 'resolvedUrl', 'destinationUrl']) === null;
  }

  private isLongPathDomainHiding(url: URL): boolean {
    return url.pathname.length >= 100 || url.href.length >= 180;
  }

  private isRecentlyRegisteredDomain(metadata: Record<string, unknown>): boolean {
    const domainAgeDays = this.metadataNumber(metadata, ['domainAgeDays', 'registeredDaysAgo', 'ageDays']);
    if (domainAgeDays !== null) return domainAgeDays >= 0 && domainAgeDays < 7;

    const registeredAt = this.metadataString(metadata, ['domainRegisteredAt', 'registeredAt']);
    if (registeredAt === null) return false;
    const registeredAtMs = Date.parse(registeredAt);
    if (!Number.isFinite(registeredAtMs)) return false;
    const nowMs = this.metadataNumber(metadata, ['nowMs']) ?? Date.now();
    return nowMs >= registeredAtMs && nowMs - registeredAtMs < 7 * 24 * 60 * 60 * 1000;
  }

  private hasSelfSignedCertificateSignal(metadata: Record<string, unknown>): boolean {
    return [
      metadata.selfSignedCertificate,
      metadata.certificateSelfSigned,
      metadata.tlsSelfSigned,
    ].some((value) => value === true);
  }

  private isAllowedCustomProtocol(url: URL): boolean {
    return url.protocol !== 'http:' && url.protocol !== 'https:' &&
      CUSTOM_PROTOCOL_ALLOWLIST.includes(url.protocol.toLowerCase());
  }

  private isTechnicalContext(metadata: Record<string, unknown>): boolean {
    if (metadata.technicalContext === true) return true;
    return this.metadataStrings(metadata, ['context', 'contextText', 'sourceText', 'text'])
      .some((value) => TECHNICAL_CONTEXT_PATTERN.test(value));
  }

  private parseUrl(rawUrl: string): URL | null {
    const normalizedUrl = this.stripTrailingPunctuation(rawUrl.trim());
    if (normalizedUrl === '') return null;

    try {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedUrl)) {
        return new URL(normalizedUrl);
      }
      if (this.hasDomainShape(normalizedUrl)) {
        return new URL(`https://${normalizedUrl}`);
      }
      return null;
    } catch {
      return null;
    }
  }

  private rawHostname(rawUrl: string): string {
    const normalizedUrl = this.stripTrailingPunctuation(rawUrl.trim());
    const authorityMatch = normalizedUrl.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
    const authority = authorityMatch?.[1] ?? normalizedUrl.split(/[/?#]/)[0] ?? '';
    const withoutCredentials = authority.includes('@') ? authority.split('@').pop() ?? authority : authority;
    return withoutCredentials.replace(/:\d+$/, '').replace(/^\[/, '').replace(/\]$/, '');
  }

  private hasDomainShape(value: string): boolean {
    return /^(?:[a-z0-9\u0400-\u04ff](?:[a-z0-9\u0400-\u04ff-]{0,61}[a-z0-9\u0400-\u04ff])?\.)+[a-z\u0400-\u04ff]{2,}(?:[/:?#].*)?$/i
      .test(value);
  }

  private isAllowedHostname(hostname: string, allowedHostnames: string[]): boolean {
    return allowedHostnames.some((allowedHostname) => (
      hostname === allowedHostname || hostname.endsWith(`.${allowedHostname}`)
    ));
  }

  private metadataReasonCodes(metadata: Record<string, unknown>): string[] {
    const reasonCodes: string[] = [];
    const reason = metadata.reason;
    if (typeof reason === 'string' && reason.trim() !== '') {
      reasonCodes.push(reason);
    }
    const metadataReasonCodes = metadata.reasonCodes;
    if (Array.isArray(metadataReasonCodes)) {
      metadataReasonCodes
        .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
        .forEach((value) => reasonCodes.push(value));
    }
    return this.unique(reasonCodes);
  }

  private metadataStrings(metadata: Record<string, unknown>, keys: string[]): string[] {
    return keys
      .map((key) => metadata[key])
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '');
  }

  private metadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
    return this.metadataStrings(metadata, keys)[0] ?? null;
  }

  private metadataNumber(metadata: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsedValue = Number(value);
        if (Number.isFinite(parsedValue)) return parsedValue;
      }
    }
    return null;
  }

  private isAllowReasonCode(reasonCode: string): boolean {
    return reasonCode === 'phishing_url_legitimate_bank' ||
      reasonCode === 'phishing_url_technical_context_allow' ||
      reasonCode === 'phishing_url_bank_partner_whitelist' ||
      reasonCode === 'urlbert_benign_high_confidence' ||
      reasonCode === 'phishing_url_custom_protocol_deeplink';
  }

  private stripTrailingPunctuation(value: string): string {
    return value.replace(/[.,;:!?)}\]]+$/g, '');
  }

  private unique(values: string[]): string[] {
    return values.filter((value, index, items) => value.trim() !== '' && items.indexOf(value) === index);
  }
}
