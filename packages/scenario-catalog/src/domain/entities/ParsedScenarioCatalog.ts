import type { CatalogScenario } from './CatalogScenario';
import type { CompositeScenario } from './CompositeScenario';
import type { ScenarioGroup } from './ScenarioGroup';

export type ParsedScenarioCatalog = {
  scenarios: CatalogScenario[];
  composites: CompositeScenario[];
  groups: ScenarioGroup[];
};
