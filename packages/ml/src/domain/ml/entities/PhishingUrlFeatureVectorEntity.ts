export type PhishingUrlFeatureVectorEntity = {
  allowedDomainMatch: number;
  hasIpAddress: number;
  hasSuspiciousToken: number;
  hasRiskyTld: number;
  hasPunycode: number;
  hasAtSign: number;
  hasManySubdomains: number;
  isLongUrl: number;
  hasBrandMimicry: number;
};
