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

  it('does not recognize composites that reference scenarios absent from the catalog', () => {
    const catalog = parsedCatalog();
    const brokenCatalog = {
      ...catalog,
      composites: [
        {
          ...catalog.composites[0],
          combo: ['CPY-01', 'UNKNOWN-01'],
        },
      ],
    };

    const result = new CompositeScenarioRecognizingService().recognize(
      [
        recognition('copy_paste_recipient', ['CPY-01']),
        recognition('new_recipient', ['UNKNOWN-01']),
      ],
      brokenCatalog,
    );

    expect(result).toEqual([]);
  });

  it('uses the minimum factor confidence and unique ordered reason codes', () => {
    const catalog = parsedCatalog();
    const customCatalog = {
      ...catalog,
      composites: [
        {
          id: 'C99',
          title: 'Custom composite',
          combo: ['CPY-01', 'NRC-01'],
          expectedVerdict: 'block',
          normalizedVerdict: 'block' as const,
        },
      ],
    };

    const result = new CompositeScenarioRecognizingService().recognize(
      [
        recognition('copy_paste_recipient', ['CPY-01'], 0.7, ['shared_reason', 'copy_paste_recipient']),
        recognition('new_recipient', ['NRC-01'], 0.4, ['shared_reason', 'new_recipient_in_flow']),
      ],
      customCatalog,
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'C99',
        confidence: 0.4,
        reasonCodes: [
          'composite_c99',
          'shared_reason',
          'copy_paste_recipient',
          'new_recipient_in_flow',
        ],
        factors: ['copy_paste_recipient', 'new_recipient'],
      }),
    ]);
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

function recognition(
  factor: ScenarioRecognitionEntity['factor'],
  candidateScenarioIds: string[],
  confidence = 1,
  reasonCodes = [factor],
): ScenarioRecognitionEntity {
  return {
    factor,
    confidence,
    reasonCodes,
    candidateScenarioIds,
    expectedVerdicts: ['block'],
  };
}
