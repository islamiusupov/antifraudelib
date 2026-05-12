import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import { RiskScoringService } from '@deepcode/antifraud-core';
import type { DeepFraudRootConfigEntity } from '../../domain/common/entities/DeepFraudRootConfigEntity';
import type { DeepFraudStateEntity } from '../../domain/common/entities/DeepFraudStateEntity';

export class DeepFraudStateReducingService {
  private readonly riskScoringService = new RiskScoringService();

  createInitialState(config: DeepFraudRootConfigEntity): DeepFraudStateEntity {
    const rootFactors = config.factors ?? [];
    return this.createState(config.userId, config.consent, rootFactors, {}, rootFactors);
  }

  replaceScopeFactors(
    state: DeepFraudStateEntity,
    scope: RiskScope,
    factors: RiskFactorEntity[],
  ): DeepFraudStateEntity {
    const scopedFactors = {
      ...state.scopedFactors,
      [scope]: factors,
    };
    const allFactors = this.collectFactors(state.rootFactors, scopedFactors);
    return this.createState(state.userId, state.consent, state.rootFactors, scopedFactors, allFactors);
  }

  private createState(
    userId: string,
    consent: DeepFraudStateEntity['consent'],
    rootFactors: RiskFactorEntity[],
    scopedFactors: DeepFraudStateEntity['scopedFactors'],
    factors: RiskFactorEntity[],
  ): DeepFraudStateEntity {
    return {
      userId,
      consent,
      rootFactors,
      scopedFactors,
      factors,
      assessment: this.riskScoringService.score({
        scope: 'transaction',
        factors,
      }),
    };
  }

  private collectFactors(
    rootFactors: RiskFactorEntity[],
    scopedFactors: DeepFraudStateEntity['scopedFactors'],
  ): RiskFactorEntity[] {
    const factors = [...rootFactors];
    Object.keys(scopedFactors).forEach((scope) => {
      const scopeFactors = scopedFactors[scope as RiskScope] ?? [];
      factors.push(...scopeFactors);
    });
    return factors;
  }
}
