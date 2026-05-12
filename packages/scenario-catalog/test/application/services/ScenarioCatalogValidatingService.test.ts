import { describe, expect, it } from 'vitest';
import { ScenarioCatalogValidatingService } from '../../../src/application/services/ScenarioCatalogValidatingService';
import { ScenarioIdBuildingService } from '../../../src/application/services/ScenarioIdBuildingService';
import type { ParsedScenarioCatalogEntity } from '../../../src/domain/entities/ParsedScenarioCatalogEntity';

describe('ScenarioCatalogValidatingService', () => {
  it('accepts a complete catalog with all expected scenario ids and ten composites', () => {
    const idBuildingService = new ScenarioIdBuildingService();
    const service = new ScenarioCatalogValidatingService(idBuildingService);
    const catalog: ParsedScenarioCatalogEntity = {
      groups: [],
      composites: Array.from({ length: 10 }, (_, index) => ({
        id: `C${index + 1}`,
        title: `Composite ${index + 1}`,
        combo: [],
        expectedVerdict: 'block',
        normalizedVerdict: 'block',
      })),
      scenarios: idBuildingService.buildExpectedIds().map((id) => ({
        id,
        factor: 'factor',
        prefix: id.slice(0, 3),
        number: Number(id.slice(4)),
        type: 'TP',
        scenario: 'Scenario',
        verdict: 'step_up',
        normalizedVerdict: 'step_up',
        kind: 'factor',
        tier: 'LIVE',
      })),
    };

    expect(service.validate(catalog)).toMatchObject({
      valid: true,
      actualScenarioCount: 340,
      actualCompositeCount: 10,
      missingIds: [],
      duplicateIds: [],
    });
  });

  it('reports missing and duplicate scenario ids', () => {
    const idBuildingService = new ScenarioIdBuildingService();
    const service = new ScenarioCatalogValidatingService(idBuildingService);
    const scenarios = idBuildingService.buildExpectedIds().slice(1).map((id) => ({
      id,
      factor: 'factor',
      prefix: id.slice(0, 3),
      number: Number(id.slice(4)),
      type: 'TP' as const,
      scenario: 'Scenario',
      verdict: 'step_up',
      normalizedVerdict: 'step_up' as const,
      kind: 'factor' as const,
      tier: 'LIVE' as const,
    }));
    scenarios.push({ ...scenarios[0] });
    const catalog: ParsedScenarioCatalogEntity = {
      groups: [],
      composites: [],
      scenarios,
    };

    const validation = service.validate(catalog);

    expect(validation.valid).toBe(false);
    expect(validation.missingIds).toContain('CPY-01');
    expect(validation.duplicateIds).toEqual([scenarios[0].id]);
  });

  it('reports unknown groups and wrong composite count as invalid', () => {
    const idBuildingService = new ScenarioIdBuildingService();
    const service = new ScenarioCatalogValidatingService(idBuildingService);
    const scenarios = idBuildingService.buildExpectedIds().map((id) => ({
      id,
      factor: 'factor',
      prefix: id === 'CPY-01' ? 'BAD' : id.slice(0, 3),
      number: Number(id.slice(4)),
      type: 'TP' as const,
      scenario: 'Scenario',
      verdict: 'step_up',
      normalizedVerdict: 'step_up' as const,
      kind: 'factor' as const,
      tier: 'LIVE' as const,
    }));
    const catalog: ParsedScenarioCatalogEntity = {
      groups: [],
      composites: [],
      scenarios,
    };

    expect(service.validate(catalog)).toMatchObject({
      valid: false,
      actualScenarioCount: 340,
      actualCompositeCount: 0,
      unknownGroups: ['BAD'],
    });
  });
});
