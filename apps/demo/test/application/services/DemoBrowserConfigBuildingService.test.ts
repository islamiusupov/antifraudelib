import { describe, expect, it } from 'vitest';
import { DemoBrowserConfigBuildingService } from '../../../src/application/services/DemoBrowserConfigBuildingService';

describe('DemoBrowserConfigBuildingService', () => {
  it('builds browser-safe D-bank iframe paths', () => {
    const service = new DemoBrowserConfigBuildingService();

    expect(service.build({ routePrefix: 'demo-bank', userId: 'user-1' })).toEqual({
      userId: 'user-1',
      consent: 'behavioral',
      dBank: {
        packageName: 'd-bank',
        distPath: '/demo-bank',
        indexHtmlPath: '/demo-bank/index.html',
        routePrefix: '/demo-bank',
        iframePath: '/demo-bank/index.html',
      },
      initialFactors: [],
    });
  });

  it('preserves caller-provided initial factors', () => {
    const service = new DemoBrowserConfigBuildingService();
    const factors = [
      {
        kind: 'copy_paste_recipient',
        contribution: 40,
        maxContribution: 40,
        status: 'ok' as const,
        reasonCodes: ['copy_paste_recipient'],
      },
    ];

    expect(service.build({ initialFactors: factors }).initialFactors).toBe(factors);
  });
});
