import type { RiskSignalEntity } from '@deepcode/antifraud-core';
import type { PhishingUrlInputEntity } from '../../domain/entities/PhishingUrlInputEntity';
import { PhishingUrlFeatureVectorBuildingService } from './PhishingUrlFeatureVectorBuildingService';
import { PhishingUrlModelScoringService } from './PhishingUrlModelScoringService';

export class PhishingUrlClassifyingService {
  constructor(
    private readonly phishingUrlFeatureVectorBuildingService = new PhishingUrlFeatureVectorBuildingService(),
    private readonly phishingUrlModelScoringService = new PhishingUrlModelScoringService(),
  ) {}

  classify(input: PhishingUrlInputEntity): RiskSignalEntity {
    const features = this.phishingUrlFeatureVectorBuildingService.build(input);
    const modelScore = this.phishingUrlModelScoringService.score(features);
    if (modelScore.score >= modelScore.threshold) {
      return {
        kind: 'phishing_url',
        detected: true,
        confidence: modelScore.score,
        reasonCodes: ['phishing_url_pattern'],
        source: 'live',
        metadata: {
          classifier: modelScore.modelId,
          modelScore: modelScore.score,
          features: modelScore.features,
        },
      };
    }
    return this.inactive();
  }

  private inactive(): RiskSignalEntity {
    return {
      kind: 'phishing_url',
      detected: false,
      confidence: 0,
      reasonCodes: [],
      source: 'live',
    };
  }
}
