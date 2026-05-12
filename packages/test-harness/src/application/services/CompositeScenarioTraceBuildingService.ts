import type { CompositeScenarioEntity, ParsedScenarioCatalogEntity } from '@deepcode/antifraud-scenario-catalog';
import type { BankActionEntity } from '../../domain/harness/entities/BankActionEntity';
import { ScenarioTraceBuildingService } from './ScenarioTraceBuildingService';

export class CompositeScenarioTraceBuildingService {
  constructor(private readonly scenarioTraceBuildingService = new ScenarioTraceBuildingService()) {}

  build(composite: CompositeScenarioEntity, catalog: ParsedScenarioCatalogEntity): BankActionEntity[] {
    const actions: BankActionEntity[] = [];
    composite.combo.forEach((scenarioId) => {
      const scenario = catalog.scenarios.find((candidate) => candidate.id === scenarioId);
      if (scenario === undefined) throw new Error(`Missing scenario ${scenarioId}`);
      this.scenarioTraceBuildingService.build(scenario).forEach((action) => actions.push(action));
    });
    return actions;
  }
}
