import { DBankStaticAssetsLocatingService } from '@deepcode/antifraud-dbank-adapter';
import type { RiskFactorEntity } from '@deepcode/antifraud-core';
import type { DemoWorkbenchConfigEntity } from '../../domain/entities/DemoWorkbenchConfigEntity';

export type DemoWorkbenchConfigBuildOptions = {
  userId?: string;
  initialFactors?: RiskFactorEntity[];
};

export class DemoWorkbenchConfigBuildingService {
  private readonly dBankStaticAssetsLocatingService = new DBankStaticAssetsLocatingService();

  build(workspaceRoot: string, options: DemoWorkbenchConfigBuildOptions = {}): DemoWorkbenchConfigEntity {
    return {
      userId: options.userId ?? 'demo-user',
      consent: 'behavioral',
      dBank: this.dBankStaticAssetsLocatingService.locate(workspaceRoot),
      initialFactors: options.initialFactors ?? [],
    };
  }
}
