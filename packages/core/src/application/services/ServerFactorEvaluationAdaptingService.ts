import type { RiskFactorEntity } from '../../domain/entities/RiskFactorEntity';
import type { ServerFactorEvaluationEntity } from '../../domain/entities/ServerFactorEvaluationEntity';

export class ServerFactorEvaluationAdaptingService {
  adapt(evaluations: ServerFactorEvaluationEntity[]): RiskFactorEntity[] {
    return evaluations.map((evaluation) => ({
      kind: evaluation.kind,
      status: evaluation.status,
      contribution: evaluation.status === 'ok' ? evaluation.contribution : 0,
      maxContribution: evaluation.maxContribution,
      reasonCodes: evaluation.reasonCodes,
      source: 'server',
      metadata: evaluation.metadata,
    }));
  }
}
