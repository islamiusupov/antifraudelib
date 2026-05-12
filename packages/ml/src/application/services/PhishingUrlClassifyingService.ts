import { PhishingUrlSignalBuildingService, type RiskSignalEntity } from '@deepcode/antifraud-core';
import type { PhishingUrlInputEntity } from '../../domain/ml/entities/PhishingUrlInputEntity';
import { PhishingUrlFeatureVectorBuildingService } from './PhishingUrlFeatureVectorBuildingService';
import { PhishingUrlModelScoringService } from './PhishingUrlModelScoringService';

const URLBERT_PHISHING_HIGH_CONFIDENCE_THRESHOLD = 0.9;
const URLBERT_BENIGN_HIGH_CONFIDENCE_THRESHOLD = 0.95;

export class PhishingUrlClassifyingService {
  constructor(
    private readonly phishingUrlFeatureVectorBuildingService = new PhishingUrlFeatureVectorBuildingService(),
    private readonly phishingUrlModelScoringService = new PhishingUrlModelScoringService(),
    private readonly phishingUrlSignalBuildingService = new PhishingUrlSignalBuildingService(),
  ) {}

  classify(input: PhishingUrlInputEntity): RiskSignalEntity {
    return this.classifyMany(input)[0] ?? this.inactive();
  }

  classifyMany(input: PhishingUrlInputEntity): RiskSignalEntity[] {
    const features = this.phishingUrlFeatureVectorBuildingService.build(input);
    const modelScore = this.phishingUrlModelScoringService.score(features);
    const metadata = {
      url: input.url,
      classifier: modelScore.modelId,
      modelScore: modelScore.score,
      benignConfidence: this.benignConfidence(modelScore.score),
      features: modelScore.features,
    };

    if (modelScore.score > URLBERT_PHISHING_HIGH_CONFIDENCE_THRESHOLD) {
      return this.phishingUrlSignalBuildingService.build(['urlbert_phishing_high_confidence'], {
        ...metadata,
        verdict: 'phishing',
      });
    }
    if (this.benignConfidence(modelScore.score) > URLBERT_BENIGN_HIGH_CONFIDENCE_THRESHOLD) {
      return [this.inactive(['urlbert_benign_high_confidence'], {
        ...metadata,
        verdict: 'benign',
      })];
    }
    if (modelScore.score >= modelScore.threshold) {
      return [{
        kind: 'phishing_url',
        detected: true,
        confidence: modelScore.score,
        reasonCodes: ['phishing_url_pattern'],
        source: 'live',
        metadata,
      }];
    }
    return [this.inactive([], metadata)];
  }

  private inactive(reasonCodes: string[] = [], metadata?: Record<string, unknown>): RiskSignalEntity {
    return {
      kind: 'phishing_url',
      detected: false,
      confidence: 0,
      reasonCodes,
      source: 'live',
      ...(metadata !== undefined ? { metadata } : {}),
    };
  }

  private benignConfidence(phishingScore: number): number {
    return Math.round((1 - phishingScore) * 10000) / 10000;
  }
}
