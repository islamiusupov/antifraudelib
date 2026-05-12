import type { RiskFactorEntity } from '../../domain/risk/entities/RiskFactorEntity';
import type { ServerFactorEvaluationEntity } from '../../domain/risk/entities/ServerFactorEvaluationEntity';

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
