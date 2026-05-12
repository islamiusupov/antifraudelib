import {
  PHISHING_URL_MODEL_ID,
  PHISHING_URL_MODEL_THRESHOLD,
  PHISHING_URL_MODEL_WEIGHTS,
} from '../../domain/constants/PhishingUrlModelWeights';
import type { MlModelScoreEntity } from '../../domain/entities/MlModelScoreEntity';
import type { PhishingUrlFeatureVectorEntity } from '../../domain/entities/PhishingUrlFeatureVectorEntity';

export class PhishingUrlModelScoringService {
  score(features: PhishingUrlFeatureVectorEntity): MlModelScoreEntity {
    const logit =
      PHISHING_URL_MODEL_WEIGHTS.bias +
      PHISHING_URL_MODEL_WEIGHTS.allowedDomainMatch * features.allowedDomainMatch +
      PHISHING_URL_MODEL_WEIGHTS.hasIpAddress * features.hasIpAddress +
      PHISHING_URL_MODEL_WEIGHTS.hasSuspiciousToken * features.hasSuspiciousToken +
      PHISHING_URL_MODEL_WEIGHTS.hasRiskyTld * features.hasRiskyTld +
      PHISHING_URL_MODEL_WEIGHTS.hasPunycode * features.hasPunycode +
      PHISHING_URL_MODEL_WEIGHTS.hasAtSign * features.hasAtSign +
      PHISHING_URL_MODEL_WEIGHTS.hasManySubdomains * features.hasManySubdomains +
      PHISHING_URL_MODEL_WEIGHTS.isLongUrl * features.isLongUrl +
      PHISHING_URL_MODEL_WEIGHTS.hasBrandMimicry * features.hasBrandMimicry;

    return {
      modelId: PHISHING_URL_MODEL_ID,
      score: this.round(this.sigmoid(logit)),
      threshold: PHISHING_URL_MODEL_THRESHOLD,
      features,
    };
  }

  private sigmoid(value: number): number {
    return 1 / (1 + Math.exp(-value));
  }

  private round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
