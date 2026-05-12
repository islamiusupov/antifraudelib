export const PHISHING_URL_MODEL_ID = 'urlbert-tiny-v4-fallback-v0';
export const PHISHING_URL_MODEL_THRESHOLD = 0.65;
export const PHISHING_URL_MODEL_WEIGHTS = {
  bias: -2.5,
  allowedDomainMatch: -6,
  hasIpAddress: 1.3,
  hasSuspiciousToken: 2.5,
  hasRiskyTld: 1.2,
  hasPunycode: 1.4,
  hasAtSign: 0.9,
  hasManySubdomains: 0.6,
  isLongUrl: 0.7,
  hasBrandMimicry: 1,
};
