export type ScenarioCatalogValidationEntity = {
  valid: boolean;
  expectedScenarioCount: number;
  actualScenarioCount: number;
  expectedCompositeCount: number;
  actualCompositeCount: number;
  missingIds: string[];
  duplicateIds: string[];
  unknownGroups: string[];
};
