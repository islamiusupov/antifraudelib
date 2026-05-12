import { FactorContributionBuildingService, type RiskFactorEntity, type RiskFactorStatus } from '@deepcode/antifraud-core';
import type { DeviceFingerprintCollectionEntity } from '../../domain/fingerprint/entities/DeviceFingerprintCollectionEntity';

export class DeviceFingerprintRiskFactorBuildingService {
  constructor(private readonly factorContributionBuildingService = new FactorContributionBuildingService()) {}

  build(collection: DeviceFingerprintCollectionEntity): RiskFactorEntity[] {
    if (collection.status === 'skipped') return [];

    if (collection.status === 'collected') {
      return [
        this.factorContributionBuildingService.build({
          kind: 'device_fingerprint',
          detected: false,
          status: 'inactive',
          source: 'live',
          metadata: this.metadata(collection),
        }),
      ];
    }

    return [
      this.factorContributionBuildingService.build({
        kind: 'device_fingerprint',
        detected: true,
        confidence: 0,
        status: this.status(collection),
        source: 'live',
        reasonCodes: collection.reasonCodes,
        metadata: this.metadata(collection),
      }),
    ];
  }

  private status(collection: DeviceFingerprintCollectionEntity): RiskFactorStatus {
    return collection.status === 'error' ? 'error' : 'insufficient_data';
  }

  private metadata(collection: DeviceFingerprintCollectionEntity): Record<string, unknown> {
    return {
      provider: collection.provider,
      status: collection.status,
      deviceFingerprintHash: collection.deviceFingerprintHash,
      ...(collection.metadata ?? {}),
    };
  }
}
