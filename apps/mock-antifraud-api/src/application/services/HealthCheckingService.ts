import { SERVER_SIDE_FACTOR_KINDS } from '../../domain/constants/ServerSideFactorKinds';
import type { HealthStatusEntity } from '../../domain/antifraud/entities/HealthStatusEntity';

export class HealthCheckingService {
  check(): HealthStatusEntity {
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
