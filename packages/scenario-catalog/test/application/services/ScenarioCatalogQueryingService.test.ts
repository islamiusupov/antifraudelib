import { describe, expect, it } from 'vitest';
import { ScenarioCatalogQueryingService } from '../../../src/application/services/ScenarioCatalogQueryingService';
import type { ParsedScenarioCatalogEntity } from '../../../src/domain/scenario/entities/ParsedScenarioCatalogEntity';

describe('ScenarioCatalogQueryingService', () => {
  it('returns a scenario by id', () => {
    const service = new ScenarioCatalogQueryingService();
    const catalog: ParsedScenarioCatalogEntity = {
      groups: [],
      composites: [],
      scenarios: [
        {
          id: 'CPY-01',
          factor: 'copy_paste_recipient',
          prefix: 'CPY',
          number: 1,
          type: 'TP',
          scenario: 'Paste recipient',
          verdict: 'step_up',
          normalizedVerdict: 'step_up',
          kind: 'factor',
          tier: 'LIVE',
        },
      ],
    };

    expect(service.getScenarioById(catalog, 'CPY-01')?.factor).toBe('copy_paste_recipient');
    expect(service.getScenarioById(catalog, 'UNKNOWN')).toBeUndefined();
  });

  it('returns a scenario group by prefix', () => {
    const service = new ScenarioCatalogQueryingService();

    expect(service.getScenarioGroupByPrefix('VIS')?.factor).toBe('visual_challenge');
    expect(service.getScenarioGroupByPrefix('NOPE')).toBeUndefined();
  });
});
