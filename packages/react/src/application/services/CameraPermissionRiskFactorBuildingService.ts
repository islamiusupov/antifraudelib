import { FactorContributionBuildingService, type RiskFactorEntity, type RiskSignalEntity } from '@deepcode/antifraud-core';
import type { VisualChallengeCameraState } from '../../domain/value-objects/VisualChallengeCameraState';

export class CameraPermissionRiskFactorBuildingService {
  constructor(private readonly factorContributionBuildingService = new FactorContributionBuildingService()) {}

  build(cameraState: VisualChallengeCameraState): RiskFactorEntity[] {
    if (cameraState === 'granted') {
      return [
        this.factorContributionBuildingService.build(
          this.signal('camera_verified', -20, 20, 'camera_verification'),
        ),
      ];
    }
    if (cameraState === 'denied') {
      return [
        this.factorContributionBuildingService.build(
          this.signal('camera_permission_denied', 10, 50, 'visual_challenge'),
        ),
      ];
    }
    if (cameraState === 'unavailable') {
      return [
        this.factorContributionBuildingService.build(
          this.signal('camera_unavailable', 10, 50, 'visual_challenge'),
        ),
      ];
    }
    return [];
  }

  private signal(
    reasonCode: string,
    contribution: number,
    maxContribution: number,
    kind: RiskSignalEntity['kind'],
  ): RiskSignalEntity {
    return {
      kind,
      detected: true,
      contribution,
      maxContribution,
      reasonCodes: [reasonCode],
      source: 'live',
    };
  }
}
