import { describe, expect, it } from 'vitest';
import { HealthCheckingService } from '../../../src/application/services/HealthCheckingService';

describe('HealthCheckingService', () => {
  it('reports all server-side factors as healthy', () => {
    const health = new HealthCheckingService().check();

    expect(health.status).toBe('ok');
    expect(health.version).toBe('mock-antifraud-api-0.1.0');
    expect(health.factors.new_recipient).toBe('ok');
    expect(health.factors.incoming_call_correlation).toBe('ok');
    expect(Object.keys(health.factors)).toHaveLength(16);
  });
});
