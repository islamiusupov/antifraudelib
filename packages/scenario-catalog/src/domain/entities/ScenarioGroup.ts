import type { ScenarioKind } from '../value-objects/ScenarioKind';
import type { ScenarioTier } from '../value-objects/ScenarioTier';

export type ScenarioGroup = {
  factor: string;
  prefix: string;
  kind: ScenarioKind;
  tier: ScenarioTier;
  expectedCount: number;
};
