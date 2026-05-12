import { describe, expect, it } from 'vitest';
import { DemoWorkbenchConfigBuildingService } from '../../../src/application/services/DemoWorkbenchConfigBuildingService';

describe('DemoWorkbenchConfigBuildingService', () => {
  it('builds D-bank workbench config from a workspace root', () => {
    const service = new DemoWorkbenchConfigBuildingService();

    expect(service.build('C:\\repo\\antifraud')).toMatchObject({
      userId: 'demo-user',
      consent: 'behavioral',
      dBank: {
        routePrefix: '/d-bank',
        iframePath: '/d-bank/index.html',
      },
      initialFactors: [],
    });
  });

  it('accepts initial factors for a preloaded fraud scenario', () => {
    const service = new DemoWorkbenchConfigBuildingService();

    const config = service.build('/repo/antifraud', {
      initialFactors: [
        {
          kind: 'copy_paste_recipient',
          contribution: 40,
          maxContribution: 40,
          status: 'ok',
          reasonCodes: ['copy_paste_recipient'],
        },
      ],
    });

    expect(config.initialFactors).toHaveLength(1);
    expect(config.initialFactors[0]?.kind).toBe('copy_paste_recipient');
  });
});
