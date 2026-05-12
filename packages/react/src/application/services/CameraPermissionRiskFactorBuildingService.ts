import { FactorContributionBuildingService, type RiskFactorEntity, type RiskSignalEntity } from '@deepcode/antifraud-core';
import type { VisualChallengeCameraState } from '../../domain/value-objects/VisualChallengeCameraState';

export class CameraPermissionRiskFactorBuildingService {
  constructor(private readonly factorContributionBuildingService = new FactorContributionBuildingService()) {}

  build(cameraState: VisualChallengeCameraState): RiskFactorEntity[] {
    if (cameraState === 'denied') {
      return [this.factorContributionBuildingService.build(this.signal('camera_permission_denied'))];
    }
    if (cameraState === 'unavailable') {
      return [this.factorContributionBuildingService.build(this.signal('camera_unavailable'))];
    }
    return [];
  }

  private signal(reasonCode: string): RiskSignalEntity {
    return {
      kind: 'visual_challenge',
      detected: true,
      confidence: 0.2,
      reasonCodes: [reasonCode],
      source: 'live',
    };
  }
}
