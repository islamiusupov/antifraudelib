import type { ScenarioVerdict } from '../../domain/value-objects/ScenarioVerdict';

export class ScenarioVerdictNormalizingService {
  normalize(verdict: string): ScenarioVerdict {
    const normalized = verdict.toLowerCase();
    if (normalized.includes('step_up')) return 'step_up';
    if (normalized.includes('block')) return 'block';
    if (normalized.includes('monitor')) return 'monitor';
    if (normalized.includes('allow')) return 'allow';
    if (normalized.includes('continue')) return 'continue';
    if (normalized.includes('varies')) return 'varies';
    return 'edge';
  }
}
