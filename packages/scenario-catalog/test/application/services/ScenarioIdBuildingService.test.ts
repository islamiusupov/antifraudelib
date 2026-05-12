import { describe, expect, it } from 'vitest';
import { ScenarioIdBuildingService } from '../../../src/application/services/ScenarioIdBuildingService';

describe('ScenarioIdBuildingService', () => {
  it('builds zero-padded scenario ids', () => {
    const service = new ScenarioIdBuildingService();

    expect(service.build('CPY', 1)).toBe('CPY-01');
    expect(service.build('CPY', 10)).toBe('CPY-10');
    expect(service.build('DFP', 100)).toBe('DFP-100');
  });

  it('builds the full expected scenario id list from known groups', () => {
    const service = new ScenarioIdBuildingService();

    const ids = service.buildExpectedIds();

    expect(ids).toHaveLength(340);
    expect(ids[0]).toBe('CPY-01');
    expect(ids[ids.length - 1]).toBe('DFP-20');
  });
});
