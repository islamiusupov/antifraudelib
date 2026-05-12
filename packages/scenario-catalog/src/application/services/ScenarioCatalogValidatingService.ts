import { SCENARIO_GROUPS } from '../../domain/constants/ScenarioGroups';
import type { ParsedScenarioCatalogEntity } from '../../domain/scenario/entities/ParsedScenarioCatalogEntity';
import type { ScenarioCatalogValidationEntity } from '../../domain/scenario/entities/ScenarioCatalogValidationEntity';
import { ScenarioIdBuildingService } from './ScenarioIdBuildingService';

export class ScenarioCatalogValidatingService {
  constructor(private readonly scenarioIdBuildingService = new ScenarioIdBuildingService()) {}

  validate(catalog: ParsedScenarioCatalogEntity): ScenarioCatalogValidationEntity {
    const expectedIds = this.scenarioIdBuildingService.buildExpectedIds();
    const seen = new Set<string>();
    const duplicateIds = new Set<string>();

    for (const scenario of catalog.scenarios) {
      if (seen.has(scenario.id)) duplicateIds.add(scenario.id);
      seen.add(scenario.id);
    }

    const missingIds = expectedIds.filter((id) => !seen.has(id));
    const knownPrefixes = new Set(SCENARIO_GROUPS.map((group) => group.prefix));
    const unknownGroups = Array.from(new Set(
      catalog.scenarios
        .map((scenario) => scenario.prefix)
        .filter((prefix) => !knownPrefixes.has(prefix)),
    ));

    return {
      valid:
        missingIds.length === 0 &&
        duplicateIds.size === 0 &&
        unknownGroups.length === 0 &&
        catalog.scenarios.length === expectedIds.length &&
        catalog.composites.length === 10,
      expectedScenarioCount: expectedIds.length,
      actualScenarioCount: catalog.scenarios.length,
      expectedCompositeCount: 10,
      actualCompositeCount: catalog.composites.length,
      missingIds,
      duplicateIds: Array.from(duplicateIds).sort(),
      unknownGroups,
    };
  }
}
