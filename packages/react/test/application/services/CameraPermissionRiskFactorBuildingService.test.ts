import { describe, expect, it } from 'vitest';
import { CameraPermissionRiskFactorBuildingService } from '../../../src/application/services/CameraPermissionRiskFactorBuildingService';

describe('CameraPermissionRiskFactorBuildingService', () => {
  it('builds a soft visual challenge factor when camera permission is denied', () => {
    const service = new CameraPermissionRiskFactorBuildingService();

    expect(service.build('denied')).toEqual([
      {
        kind: 'visual_challenge',
        status: 'ok',
        contribution: 10,
        maxContribution: 50,
        reasonCodes: ['camera_permission_denied'],
        source: 'live',
        metadata: undefined,
      },
    ]);
  });

  it('does not add risk when camera is idle or requesting', () => {
    const service = new CameraPermissionRiskFactorBuildingService();

    expect(service.build('idle')).toEqual([]);
    expect(service.build('requesting')).toEqual([]);
  });

  it('builds a mitigation factor when camera permission is granted', () => {
    const service = new CameraPermissionRiskFactorBuildingService();

    expect(service.build('granted')).toEqual([
      {
        kind: 'camera_verification',
        status: 'ok',
        contribution: -20,
        maxContribution: 20,
        reasonCodes: ['camera_verified'],
        source: 'live',
        metadata: undefined,
      },
    ]);
  });

  it('builds a soft visual challenge factor when camera API is unavailable', () => {
    const service = new CameraPermissionRiskFactorBuildingService();

    expect(service.build('unavailable')).toEqual([
      {
        kind: 'visual_challenge',
        status: 'ok',
        contribution: 10,
        maxContribution: 50,
        reasonCodes: ['camera_unavailable'],
        source: 'live',
        metadata: undefined,
      },
    ]);
  });
});
