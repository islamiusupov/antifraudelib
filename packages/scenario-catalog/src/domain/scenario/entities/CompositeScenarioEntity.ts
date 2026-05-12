import type { ScenarioVerdict } from '../../value-objects/ScenarioVerdict';

export type CompositeScenarioEntity = {
  id: string;
  title: string;
  combo: string[];
  expectedVerdict: string;
  normalizedVerdict: ScenarioVerdict;
};
