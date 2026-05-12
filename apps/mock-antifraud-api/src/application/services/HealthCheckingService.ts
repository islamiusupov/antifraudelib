import { SERVER_SIDE_FACTOR_KINDS } from '../../domain/constants/ServerSideFactorKinds';
import type { HealthStatus } from '../../domain/entities/HealthStatus';

export class HealthCheckingService {
  check(): HealthStatus {
    const factors: Record<string, 'ok'> = {};
    for (const kind of SERVER_SIDE_FACTOR_KINDS) {
      factors[kind] = 'ok';
    }

    return {
      status: 'ok',
      version: 'mock-antifraud-api-0.1.0',
      factors,
    };
  }
}
