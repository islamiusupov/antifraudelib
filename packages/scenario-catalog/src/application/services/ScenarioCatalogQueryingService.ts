import { SCENARIO_GROUPS } from '../../domain/constants/ScenarioGroups';
import type { CatalogScenario } from '../../domain/entities/CatalogScenario';
import type { ParsedScenarioCatalog } from '../../domain/entities/ParsedScenarioCatalog';
import type { ScenarioGroup } from '../../domain/entities/ScenarioGroup';

export class ScenarioCatalogQueryingService {
  private readonly groupByPrefix = new Map(SCENARIO_GROUPS.map((group) => [group.prefix, group]));

  getScenarioById(catalog: ParsedScenarioCatalog, id: string): CatalogScenario | undefined {
    return catalog.scenarios.find((scenario) => scenario.id === id);
  }

  getScenarioGroupByPrefix(prefix: string): ScenarioGroup | undefined {
    return this.groupByPrefix.get(prefix);
  }
}
