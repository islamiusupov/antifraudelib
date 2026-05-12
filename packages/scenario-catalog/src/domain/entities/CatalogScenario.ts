import type { ScenarioKind } from '../value-objects/ScenarioKind';
import type { ScenarioTier } from '../value-objects/ScenarioTier';
import type { ScenarioType } from '../value-objects/ScenarioType';
import type { ScenarioVerdict } from '../value-objects/ScenarioVerdict';

export type CatalogScenario = {
  id: string;
  factor: string;
  prefix: string;
  number: number;
  type: ScenarioType;
  scenario: string;
  verdict: string;
  normalizedVerdict: ScenarioVerdict;
  kind: ScenarioKind;
  tier: ScenarioTier;
};
