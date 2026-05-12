import { describe, expect, it } from 'vitest';
import { ScenarioVerdictNormalizingService } from '../../../src/application/services/ScenarioVerdictNormalizingService';

describe('ScenarioVerdictNormalizingService', () => {
  it.each([
    ['allow', 'allow'],
    ['monitor (+ outdated_browser reason)', 'monitor'],
    ['step_up + manual review', 'step_up'],
    ['block (visual challenge + recall)', 'block'],
    ['continue', 'continue'],
    ['varies; fallback к recall question', 'varies'],
    ['edge: tune model', 'edge'],
    ['  BLOCK (manual review) ', 'block'],
    ['allow only after monitor review', 'monitor'],
  ] as const)('normalizes %s to %s', (input, expected) => {
    const service = new ScenarioVerdictNormalizingService();

    expect(service.normalize(input)).toBe(expected);
  });
});
