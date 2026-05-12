import type { ScenarioVerdict } from '../value-objects/ScenarioVerdict';

export type CompositeScenario = {
  id: string;
  title: string;
  combo: string[];
  expectedVerdict: string;
  normalizedVerdict: ScenarioVerdict;
};
