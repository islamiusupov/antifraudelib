import type { FactorContributionEntity } from '../../domain/entities/FactorContributionEntity';
import type { RiskAssessmentEntity } from '../../domain/entities/RiskAssessmentEntity';
import type { RiskDecisionLevel } from '../../domain/value-objects/RiskDecisionLevel';
import type { RiskFactorEntity } from '../../domain/entities/RiskFactorEntity';
import type { RiskFactorStatus } from '../../domain/value-objects/RiskFactorStatus';
import type { RiskReasonEntity } from '../../domain/entities/RiskReasonEntity';
import type { RiskScoringRequestEntity } from '../../domain/entities/RiskScoringRequestEntity';

export class RiskScoringService {
  score(request: RiskScoringRequestEntity): RiskAssessmentEntity {
    const maxScore = this.normalizeMaxScore(request.maxScore);
    const factorContributions = request.factors.map((factor) => this.normalizeFactorContribution(factor));
    const score = Math.round(
      this.clamp(
        factorContributions.reduce((total, factor) => total + factor.contribution, 0),
        0,
        maxScore,
      ),
    );
    const reasons = this.buildReasons(factorContributions);

    return {
      scope: request.scope,
      score,
      decision: {
        level: this.resolveDecisionLevel(score),
        score,
        reasons,
      },
      factorContributions,
    };
  }

  private normalizeMaxScore(maxScore?: number): number {
    if (maxScore === undefined) return 100;
    return this.clamp(maxScore, 1, 100);
  }

  private normalizeFactorContribution(factor: RiskFactorEntity): FactorContributionEntity {
    const status = factor.status ?? 'ok';
    const rawContribution = this.normalizeNumber(factor.contribution);
    const maxContribution = this.normalizeMaxContribution(factor.maxContribution, rawContribution);
    const contribution = this.isScoringStatus(status) ? this.clamp(rawContribution, 0, maxContribution) : 0;

    return {
      kind: factor.kind,
      status,
      source: factor.source,
      rawContribution,
      contribution,
      maxContribution,
      reasonCodes: factor.reasonCodes ?? [],
      metadata: factor.metadata,
    };
  }

  private normalizeMaxContribution(maxContribution: number | undefined, fallback: number): number {
    if (maxContribution === undefined) {
      return Math.max(this.normalizeNumber(fallback), 0);
    }
    return Math.max(this.normalizeNumber(maxContribution), 0);
  }

  private isScoringStatus(status: RiskFactorStatus): boolean {
    return status === 'ok';
  }

  private buildReasons(factorContributions: FactorContributionEntity[]): RiskReasonEntity[] {
    const indexedReasons: Array<RiskReasonEntity & { index: number }> = [];
    factorContributions.forEach((factorContribution, index) => {
      if (factorContribution.contribution <= 0) return;
      const reasonCodes =
        factorContribution.reasonCodes.length > 0 ? factorContribution.reasonCodes : [factorContribution.kind];
      reasonCodes.forEach((code) => {
        indexedReasons.push({
          code,
          factorKind: factorContribution.kind,
          contribution: factorContribution.contribution,
          index,
        });
      });
    });

    indexedReasons.sort((left, right) => {
      if (right.contribution !== left.contribution) return right.contribution - left.contribution;
      return left.index - right.index;
    });

    return indexedReasons.map((reason) => ({
      code: reason.code,
      factorKind: reason.factorKind,
      contribution: reason.contribution,
    }));
  }

  private resolveDecisionLevel(score: number): RiskDecisionLevel {
    if (score >= 85) return 'block';
    if (score >= 60) return 'step_up';
    if (score >= 30) return 'monitor';
    return 'allow';
  }

  private normalizeNumber(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return value;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
