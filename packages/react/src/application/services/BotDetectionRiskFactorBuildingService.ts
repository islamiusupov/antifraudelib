import { FactorContributionBuildingService, type RiskFactorEntity, type RiskFactorStatus } from '@deepcode/antifraud-core';
import type { BotDetectionCollectionEntity } from '../../domain/entities/BotDetectionCollectionEntity';

export class BotDetectionRiskFactorBuildingService {
  constructor(private readonly factorContributionBuildingService = new FactorContributionBuildingService()) {}

  build(collection: BotDetectionCollectionEntity): RiskFactorEntity[] {
    if (collection.status === 'skipped') return [];

    if (collection.status === 'detected') {
      return [
        this.factorContributionBuildingService.build({
          kind: 'bot_detection',
          detected: true,
          confidence: 1,
          source: 'live',
          reasonCodes: collection.reasonCodes,
          metadata: this.metadata(collection),
        }),
      ];
    }

    if (collection.status === 'not_detected') {
      return [
        this.factorContributionBuildingService.build({
          kind: 'bot_detection',
          detected: false,
          status: 'inactive',
          source: 'live',
          metadata: this.metadata(collection),
        }),
      ];
    }

    return [
      this.factorContributionBuildingService.build({
        kind: 'bot_detection',
        detected: true,
        confidence: 0,
        status: this.status(collection),
        source: 'live',
        reasonCodes: collection.reasonCodes,
        metadata: this.metadata(collection),
      }),
    ];
  }

  private status(collection: BotDetectionCollectionEntity): RiskFactorStatus {
    return collection.status === 'error' ? 'error' : 'insufficient_data';
  }

  private metadata(collection: BotDetectionCollectionEntity): Record<string, unknown> {
    return {
      provider: collection.provider,
      status: collection.status,
      botKind: collection.botKind,
      ...(collection.metadata ?? {}),
    };
  }
}
