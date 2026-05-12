import type { CatalogScenarioEntity } from './CatalogScenarioEntity';
import type { CompositeScenarioEntity } from './CompositeScenarioEntity';
import type { ScenarioGroupEntity } from './ScenarioGroupEntity';

export type ParsedScenarioCatalogEntity = {
  scenarios: CatalogScenarioEntity[];
  composites: CompositeScenarioEntity[];
  groups: ScenarioGroupEntity[];
};
