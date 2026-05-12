import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ScenarioCatalogParsingService } from '@deepcode/antifraud-scenario-catalog';
import { BankActionScenarioRecognizingService } from '../../../src/application/services/BankActionScenarioRecognizingService';
import { CompositeScenarioRecognizingService } from '../../../src/application/services/CompositeScenarioRecognizingService';
import { ScenarioTraceBuildingService } from '../../../src/application/services/ScenarioTraceBuildingService';
import type { BankActionEntity } from '../../../src/domain/entities/BankActionEntity';
import type { ScenarioRecognitionEntity } from '../../../src/domain/entities/ScenarioRecognitionEntity';

describe('CompositeScenarioRecognizingService', () => {
  it('recognizes C1 when bank actions contain every required PRD factor', () => {
    const catalog = parsedCatalog();
    const factorResult = new BankActionScenarioRecognizingService().recognize(
      [
        ...new ScenarioTraceBuildingService().build(findScenario('CMD-01', catalog)),
        ...new ScenarioTraceBuildingService().build(findScenario('PTD-02', catalog)),
        ...new ScenarioTraceBuildingService().build(findScenario('CPY-01', catalog)),
        ...new ScenarioTraceBuildingService().build(findScenario('WDW-06', catalog)),
        ...new ScenarioTraceBuildingService().build(findScenario('KST-01', catalog)),
        ...new ScenarioTraceBuildingService().build(findScenario('PGV-07', catalog)),
      ],
      catalog,
    );

    const result = new CompositeScenarioRecognizingService().recognize(factorResult.recognitions, catalog);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'C1',
          expectedVerdict: 'block',
          requiredScenarioIds: ['CMD-01', 'PTD-02', 'CPY-01', 'WDW-06', 'KST-01', 'PGV-07'],
          matchedScenarioIds: ['CMD-01', 'PTD-02', 'CPY-01', 'WDW-06', 'KST-01', 'PGV-07'],
        }),
      ]),
    );
  });

  it('does not recognize a composite when one combo scenario is absent', () => {
    const catalog = parsedCatalog();

    const result = new CompositeScenarioRecognizingService().recognize(
      [
        recognition('concurrent_media', ['CMD-01']),
        recognition('phishing_text_dom', ['PTD-02']),
        recognition('copy_paste_recipient', ['CPY-01']),
        recognition('warning_dwell', ['WDW-06']),
        recognition('keystroke_dynamics', ['KST-01']),
      ],
      catalog,
    );

    expect(result.some((recognition) => recognition.id === 'C1')).toBe(false);
  });
});

function parsedCatalog() {
  return new ScenarioCatalogParsingService().parse(
    readFileSync(join(process.cwd(), 'prd', 'Scenarios_Catalog_v0.3.md'), 'utf8'),
  );
}

function findScenario(id: string, catalog: ReturnType<ScenarioCatalogParsingService['parse']>) {
  const scenario = catalog.scenarios.find((candidate) => candidate.id === id);
  if (scenario === undefined) throw new Error(`Missing scenario ${id}`);
  return scenario;
}

function recognition(factor: ScenarioRecognitionEntity['factor'], candidateScenarioIds: string[]): ScenarioRecognitionEntity {
  return {
    factor,
    confidence: 1,
    reasonCodes: [factor],
    candidateScenarioIds,
    expectedVerdicts: ['block'],
  };
}
