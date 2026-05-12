import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ScenarioCatalogParsingService } from '@deepcode/antifraud-scenario-catalog';
import { BankActionScenarioRecognizingService } from '../../../src/application/services/BankActionScenarioRecognizingService';
import { CompositeScenarioTraceBuildingService } from '../../../src/application/services/CompositeScenarioTraceBuildingService';

describe('CompositeScenarioTraceBuildingService', () => {
  it('builds traces that let the recognizer cover every PRD composite scenario', () => {
    const catalog = new ScenarioCatalogParsingService().parse(
      readFileSync(join(process.cwd(), 'prd', 'Scenarios_Catalog_v0.3.md'), 'utf8'),
    );
    const traceBuildingService = new CompositeScenarioTraceBuildingService();
    const recognizingService = new BankActionScenarioRecognizingService();

    const uncoveredCompositeIds = catalog.composites.filter((composite) => {
      const result = recognizingService.recognize(traceBuildingService.build(composite, catalog), catalog);
      return !result.compositeRecognitions.some((recognition) => recognition.id === composite.id);
    });

    expect(catalog.composites).toHaveLength(10);
    expect(uncoveredCompositeIds).toEqual([]);
  });
});
