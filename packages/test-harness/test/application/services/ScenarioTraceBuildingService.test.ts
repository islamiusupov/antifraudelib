import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { ScenarioCatalogParsingService } from '@deepcode/antifraud-scenario-catalog';
import { BankActionScenarioRecognizingService } from '../../../src/application/services/BankActionScenarioRecognizingService';
import { ScenarioTraceBuildingService } from '../../../src/application/services/ScenarioTraceBuildingService';

describe('ScenarioTraceBuildingService', () => {
  it('builds traces that let the recognizer cover every PRD scenario', () => {
    const catalog = new ScenarioCatalogParsingService().parse(
      readFileSync(join(process.cwd(), 'prd', 'Scenarios_Catalog_v0.3.md'), 'utf8'),
    );
    const traceBuildingService = new ScenarioTraceBuildingService();
    const recognizingService = new BankActionScenarioRecognizingService();

    const uncoveredScenarioIds = catalog.scenarios.filter((scenario) => {
      const result = recognizingService.recognize(traceBuildingService.build(scenario), catalog);
      return !result.recognitions.some((recognition) => {
        return recognition.factor === scenario.factor && recognition.candidateScenarioIds.includes(scenario.id);
      });
    });

    expect(catalog.scenarios).toHaveLength(340);
    expect(uncoveredScenarioIds).toEqual([]);
  });

  it('builds specific D-bank traces for warning dwell and visual challenge scenarios', () => {
    const service = new ScenarioTraceBuildingService();
    const catalog = new ScenarioCatalogParsingService().parse(
      readFileSync(join(process.cwd(), 'prd', 'Scenarios_Catalog_v0.3.md'), 'utf8'),
    );

    expect(service.build(catalog.scenarios.find((scenario) => scenario.id === 'WDW-01') ?? catalog.scenarios[0]).map((action) => action.kind)).toEqual([
      'bank_opened',
      'transfer_opened',
      'warning_shown',
      'warning_confirmed',
      'transfer_submitted',
    ]);
    expect(service.build(catalog.scenarios.find((scenario) => scenario.id === 'VIS-02') ?? catalog.scenarios[0]).map((action) => action.kind)).toEqual([
      'bank_opened',
      'visual_challenge_started',
    ]);
  });

  it('uses a generic server-factor event for factors without direct D-bank actions', () => {
    const service = new ScenarioTraceBuildingService();
    const catalog = new ScenarioCatalogParsingService().parse(
      readFileSync(join(process.cwd(), 'prd', 'Scenarios_Catalog_v0.3.md'), 'utf8'),
    );

    expect(
      service.build({
        ...catalog.scenarios[0],
        id: 'GEO-01',
        factor: 'geoip_jump',
      }),
    ).toEqual([
      { kind: 'bank_opened', atMs: 0, metadata: undefined },
      { kind: 'transfer_opened', atMs: 100, metadata: undefined },
      { kind: 'server_factor_observed', atMs: 300, metadata: { factor: 'geoip_jump' } },
      { kind: 'transfer_submitted', atMs: 1000, metadata: undefined },
    ]);
  });
});
