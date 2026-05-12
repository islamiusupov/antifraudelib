import { RISK_FACTOR_DEFINITIONS } from '../../domain/constants/RiskFactorDefinitions';
import type { FactorDefinitionEntity } from '../../domain/risk/entities/FactorDefinitionEntity';
import type { RiskFactorEntity } from '../../domain/risk/entities/RiskFactorEntity';
import type { RiskSignalEntity } from '../../domain/risk/entities/RiskSignalEntity';

export class FactorContributionBuildingService {
  private readonly definitionsByKind = new Map<string, FactorDefinitionEntity>(
    RISK_FACTOR_DEFINITIONS.map((definition) => [definition.kind, definition]),
  );

  build(signal: RiskSignalEntity): RiskFactorEntity {
    const definition = this.definitionsByKind.get(signal.kind);
    const maxContribution = this.resolveMaxContribution(signal, definition);
    const status = signal.status ?? (signal.detected ? 'ok' : 'inactive');
    const contribution = status === 'ok' ? this.resolveContribution(signal, maxContribution) : 0;

    return {
      kind: signal.kind,
      status,
      contribution,
      maxContribution,
      reasonCodes: signal.detected ? signal.reasonCodes ?? [signal.kind] : [],
      source: signal.source ?? definition?.source,
      metadata: signal.metadata,
    };
  }

  buildMany(signals: RiskSignalEntity[]): RiskFactorEntity[] {
    return signals.map((signal) => this.build(signal));
  }

  getDefinition(kind: string): FactorDefinitionEntity | undefined {
    return this.definitionsByKind.get(kind);
  }

  private resolveMaxContribution(signal: RiskSignalEntity, definition?: FactorDefinitionEntity): number {
    if (signal.maxContribution !== undefined || definition?.maxContribution !== undefined) {
      return this.normalizeNonNegativeNumber(signal.maxContribution ?? definition?.maxContribution ?? 0);
    }
    return Math.abs(this.normalizeNumber(signal.contribution ?? 0));
  }

  private resolveContribution(signal: RiskSignalEntity, maxContribution: number): number {
    if (signal.contribution !== undefined) {
      return this.clamp(this.normalizeNumber(signal.contribution), -maxContribution, maxContribution);
    }
    return this.clamp(maxContribution * this.resolveConfidence(signal.confidence), 0, maxContribution);
  }

  private resolveConfidence(confidence?: number): number {
    if (confidence === undefined) return 1;
    return this.clamp(this.normalizeNonNegativeNumber(confidence), 0, 1);
  }

  private normalizeNonNegativeNumber(value: number): number {
    return Math.max(this.normalizeNumber(value), 0);
  }

  private normalizeNumber(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return value;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
