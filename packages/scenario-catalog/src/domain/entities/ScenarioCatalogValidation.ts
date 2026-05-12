export type ScenarioCatalogValidation = {
  valid: boolean;
  expectedScenarioCount: number;
  actualScenarioCount: number;
  expectedCompositeCount: number;
  actualCompositeCount: number;
  missingIds: string[];
  duplicateIds: string[];
  unknownGroups: string[];
};
