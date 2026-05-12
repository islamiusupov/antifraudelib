import type { RiskFactorEntity, RiskScope } from '@deepcode/antifraud-core';
import { RiskScoringService } from '@deepcode/antifraud-core';
import type { DeepFraudRootConfigEntity } from '../../domain/common/entities/DeepFraudRootConfigEntity';
import type { DeepFraudStateEntity } from '../../domain/common/entities/DeepFraudStateEntity';

export class DeepFraudStateReducingService {
  private readonly riskScoringService = new RiskScoringService();

  createInitialState(config: DeepFraudRootConfigEntity): DeepFraudStateEntity {
    const rootFactors = config.factors ?? [];
    return this.createState(config.userId, config.consent, rootFactors, {}, this.addCompositeFactors(this.deduplicateFactors(rootFactors)));
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
    return this.addCompositeFactors(this.deduplicateFactors(factors));
  }

  private addCompositeFactors(factors: RiskFactorEntity[]): RiskFactorEntity[] {
    if (this.hasFactor(factors, 'composite_risk_boost')) return factors;
    if (
      this.hasFactor(factors, 'new_recipient') &&
      this.hasFactor(factors, 'copy_paste_recipient') &&
      this.hasFactor(factors, 'concurrent_media')
    ) {
      return this.withCompositeBoost(factors, 'new_recipient_copy_paste_concurrent_media_composite');
    }
    if (
      this.hasFactor(factors, 'new_recipient') &&
      this.hasFactor(factors, 'phishing_text_dom') &&
      this.hasFactor(factors, 'warning_dwell')
    ) {
      return this.withCompositeBoost(factors, 'new_recipient_phishing_warning_skip_composite');
    }
    if (
      this.hasFactor(factors, 'new_recipient') &&
      this.hasFactor(factors, 'page_visibility') &&
      this.hasFactor(factors, 'amount_anomaly')
    ) {
      return this.withCompositeBoost(factors, 'new_recipient_page_visibility_amount_composite');
    }
    return factors;
  }

  private withCompositeBoost(factors: RiskFactorEntity[], reasonCode: string): RiskFactorEntity[] {
    return [
      ...factors,
      {
        kind: 'composite_risk_boost',
        contribution: 10,
        maxContribution: 10,
        status: 'ok',
        source: 'live',
        reasonCodes: [reasonCode],
      },
    ];
  }

  private hasFactor(factors: RiskFactorEntity[], kind: RiskFactorEntity['kind']): boolean {
    return factors.some((factor) => factor.kind === kind && (factor.status ?? 'ok') === 'ok' && factor.contribution > 0);
  }

  private deduplicateFactors(factors: RiskFactorEntity[]): RiskFactorEntity[] {
    const factorsByKind = new Map<string, RiskFactorEntity>();

    factors.forEach((factor) => {
      const existingFactor = factorsByKind.get(factor.kind);
      if (existingFactor === undefined) {
        factorsByKind.set(factor.kind, factor);
        return;
      }

      factorsByKind.set(factor.kind, this.mergeFactor(existingFactor, factor));
    });

    return Array.from(factorsByKind.values());
  }

  private mergeFactor(left: RiskFactorEntity, right: RiskFactorEntity): RiskFactorEntity {
    const selectedFactor = right.contribution > left.contribution ? right : left;

    return {
      ...selectedFactor,
      contribution: Math.max(left.contribution, right.contribution),
      maxContribution: Math.max(left.maxContribution ?? left.contribution, right.maxContribution ?? right.contribution),
      reasonCodes: this.uniqueReasonCodes(left.reasonCodes, right.reasonCodes),
    };
  }

  private uniqueReasonCodes(
    leftReasonCodes: RiskFactorEntity['reasonCodes'],
    rightReasonCodes: RiskFactorEntity['reasonCodes'],
  ): string[] {
    return Array.from(new Set([...(leftReasonCodes ?? []), ...(rightReasonCodes ?? [])]));
  }
}
