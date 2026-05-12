import type { RiskFactorEntity } from '@deepcode/antifraud-core';
import type { DemoWorkbenchConfigEntity } from '../../domain/demo/entities/DemoWorkbenchConfigEntity';

export type DemoBrowserConfigBuildingOptions = {
  routePrefix?: string;
  userId?: string;
  initialFactors?: RiskFactorEntity[];
};

export class DemoBrowserConfigBuildingService {
  build(options: DemoBrowserConfigBuildingOptions = {}): DemoWorkbenchConfigEntity {
    const routePrefix = this.normalizeRoutePrefix(options.routePrefix ?? '/d-bank');

    return {
      userId: options.userId ?? 'demo-user',
      consent: 'behavioral',
      dBank: {
        packageName: 'd-bank',
        distPath: routePrefix,
        indexHtmlPath: `${routePrefix}/index.html`,
        routePrefix,
        iframePath: `${routePrefix}/index.html`,
      },
      initialFactors: options.initialFactors ?? [],
    };
  }

  private normalizeRoutePrefix(routePrefix: string): string {
    return `/${routePrefix.replace(/^\/+|\/+$/g, '')}`;
  }
}
