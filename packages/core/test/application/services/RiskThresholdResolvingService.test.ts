import { describe, expect, it } from 'vitest';
import { RiskThresholdResolvingService } from '../../../src/application/services/RiskThresholdResolvingService';

describe('RiskThresholdResolvingService', () => {
  it('resolves default PRD decision thresholds', () => {
    const service = new RiskThresholdResolvingService();

    expect(service.resolve(0)).toBe('allow');
    expect(service.resolve(29)).toBe('allow');
    expect(service.resolve(30)).toBe('monitor');
    expect(service.resolve(59)).toBe('monitor');
    expect(service.resolve(60)).toBe('step_up');
    expect(service.resolve(84)).toBe('step_up');
    expect(service.resolve(85)).toBe('block');
    expect(service.resolve(100)).toBe('block');
  });

  it('supports bank-specific threshold overrides', () => {
    const service = new RiskThresholdResolvingService();

    expect(
      service.resolve(50, {
        monitor: 20,
        stepUp: 45,
        block: 70,
      }),
    ).toBe('step_up');
  });

  it('treats override boundaries as inclusive lower bounds', () => {
    const service = new RiskThresholdResolvingService();
    const thresholds = {
      monitor: 10,
      stepUp: 20,
      block: 30,
    };

    expect(service.resolve(9, thresholds)).toBe('allow');
    expect(service.resolve(10, thresholds)).toBe('monitor');
    expect(service.resolve(20, thresholds)).toBe('step_up');
    expect(service.resolve(30, thresholds)).toBe('block');
  });
});
