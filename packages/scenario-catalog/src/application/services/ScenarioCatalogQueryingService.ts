import { SCENARIO_GROUPS } from '../../domain/constants/ScenarioGroups';
import type { CatalogScenarioEntity } from '../../domain/entities/CatalogScenarioEntity';
import type { ParsedScenarioCatalogEntity } from '../../domain/entities/ParsedScenarioCatalogEntity';
import type { ScenarioGroupEntity } from '../../domain/entities/ScenarioGroupEntity';

export class ScenarioCatalogQueryingService {
  private readonly groupByPrefix = new Map(SCENARIO_GROUPS.map((group) => [group.prefix, group]));

  getScenarioById(catalog: ParsedScenarioCatalogEntity, id: string): CatalogScenarioEntity | undefined {
    return catalog.scenarios.find((scenario) => scenario.id === id);
  }

  getScenarioGroupByPrefix(prefix: string): ScenarioGroupEntity | undefined {
    return this.groupByPrefix.get(prefix);
  }
}
