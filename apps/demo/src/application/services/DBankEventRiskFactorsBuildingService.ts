import { FactorContributionBuildingService, type RiskFactorEntity } from '@deepcode/antifraud-core';
import { DBankLiveFactorExtractingService, type DBankObservedEventEntity } from '@deepcode/antifraud-dbank-adapter';

export class DBankEventRiskFactorsBuildingService {
  constructor(
    private readonly dBankLiveFactorExtractingService = new DBankLiveFactorExtractingService(),
    private readonly factorContributionBuildingService = new FactorContributionBuildingService(),
  ) {}

  build(events: DBankObservedEventEntity[]): RiskFactorEntity[] {
    return this.factorContributionBuildingService.buildMany(this.dBankLiveFactorExtractingService.extract(events));
  }
}
