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

  it('does not add risk when camera is idle, requesting, or granted', () => {
    const service = new CameraPermissionRiskFactorBuildingService();

    expect(service.build('idle')).toEqual([]);
    expect(service.build('requesting')).toEqual([]);
    expect(service.build('granted')).toEqual([]);
  });
});
